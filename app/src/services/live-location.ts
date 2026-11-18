// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: wraps modules/expo-live-location; not in that folder, where a .ts file falls outside
// keep-comment: tsconfig and gets phantom DOM-vs-React-Native type conflicts
import { NativeModule, requireNativeModule } from "expo";
import type { EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";

import { logger } from "./logger";

export type LiveFix = {
  latitude: number;
  longitude: number;
  // keep-comment: metres, negative when iOS has none
  accuracy: number;
  // keep-comment: epoch ms
  timestamp: number;
};

type LiveLocationModuleEvents = {
  onLocation(fix: LiveFix): void;
};

declare class ExpoLiveLocationNativeModule extends NativeModule<LiveLocationModuleEvents> {
  // keep-comment: iOS 18+ only
  isAvailable(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  // keep-comment: also clears the buffer
  drain(): Promise<LiveFix[]>;
}

// keep-comment: Apple only; requireNativeModule throws elsewhere, and null means expo-location
const nativeModule: ExpoLiveLocationNativeModule | null = (() => {
  if (Platform.OS !== "ios") return null;
  try {
    return requireNativeModule<ExpoLiveLocationNativeModule>("ExpoLiveLocation");
  } catch (e) {
    // keep-comment: a silent drop to worse background tracking; logger, not analytics, so it survives declined consent
    logger.warn("Native live-location module failed to load on iOS; using expo-location", {
      reason: "module_load_failed",
      error: String(e),
    });

    return null;
  }
})();

export function isLiveLocationAvailable(): boolean {
  return nativeModule?.isAvailable() ?? false;
}

export function startLiveLocation(): Promise<void> {
  return nativeModule?.start() ?? Promise.resolve();
}

export function stopLiveLocation(): Promise<void> {
  return nativeModule?.stop() ?? Promise.resolve();
}

export function drainLiveLocation(): Promise<LiveFix[]> {
  return nativeModule?.drain() ?? Promise.resolve([]);
}

export function addLiveLocationListener(listener: (fix: LiveFix) => void): EventSubscription | null {
  return nativeModule?.addListener("onLocation", listener) ?? null;
}
