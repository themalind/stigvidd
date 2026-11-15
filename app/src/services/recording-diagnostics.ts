// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import * as Location from "expo-location";
import { Platform } from "react-native";
import { logger, LogContext } from "./logger";

type BatteryModule = typeof import("expo-battery");

// A binary built before expo-battery was added has no native module, and an OTA update still reaches it. keep-comment: why the lazy require
function loadBattery(): BatteryModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- keep-comment: lazy load, see above
    return require("expo-battery") as BatteryModule;
  } catch {
    return null;
  }
}

const battery = loadBattery();

async function settle<T>(read: () => Promise<T>): Promise<T | "unknown"> {
  try {
    return await read();
  } catch {
    return "unknown";
  }
}

async function permissionState(): Promise<LogContext> {
  const foreground = await settle(() => Location.getForegroundPermissionsAsync());
  const background = await settle(() => Location.getBackgroundPermissionsAsync());

  return {
    foregroundPermission: foreground === "unknown" ? foreground : foreground.status,
    backgroundPermission: background === "unknown" ? background : background.status,
    accuracyGrant: foreground === "unknown" ? foreground : (foreground.android?.accuracy ?? foreground.ios?.scope),
  };
}

// No "location" in a key: redact() blanks every key containing it. keep-comment: hidden logger constraint
async function providerState(): Promise<LogContext> {
  const status = await settle(() => Location.getProviderStatusAsync());
  if (status === "unknown") return { positioningEnabled: status };

  return {
    positioningEnabled: status.locationServicesEnabled,
    gpsAvailable: status.gpsAvailable,
    networkProviderAvailable: status.networkAvailable,
  };
}

export async function isBackgroundTaskRunning(taskName: string): Promise<boolean | "unknown"> {
  return settle(() => Location.hasStartedLocationUpdatesAsync(taskName));
}

async function batteryState(): Promise<LogContext> {
  if (!battery) return { lowPowerMode: "unknown" };

  const level = await settle(() => battery.getBatteryLevelAsync());

  return {
    lowPowerMode: await settle(() => battery.isLowPowerModeEnabledAsync()),
    batteryOptimization:
      Platform.OS === "android" ? await settle(() => battery.isBatteryOptimizationEnabledAsync()) : undefined,
    batteryPercent: typeof level === "number" && level >= 0 ? Math.round(level * 100) : "unknown",
  };
}

export async function recordingEnvironment(): Promise<LogContext> {
  const [permissions, providers, battery] = await Promise.all([permissionState(), providerState(), batteryState()]);
  return { ...permissions, ...providers, ...battery };
}

export type RecordingMoment = "started" | "stopped" | "foregrounded" | "backgrounded";

export async function logRecordingEnvironment(moment: RecordingMoment, context: LogContext = {}): Promise<void> {
  try {
    logger.info(`Hike recording ${moment}`, { ...context, ...(await recordingEnvironment()) });
  } catch {
    return;
  }
}
