// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

type Diagnostics = typeof import("../recording-diagnostics") & Pick<typeof import("../logger"), "redact">;

const location = {
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  getProviderStatusAsync: jest.fn(),
};

function load(battery: object | "missing", os: "android" | "ios" = "android"): Diagnostics {
  let mod: Diagnostics | undefined;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: os } }));
    jest.doMock("expo-location", () => location);
    jest.doMock("expo-battery", () => {
      if (battery === "missing") throw new Error("Cannot find native module 'ExpoBattery'");
      return battery;
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- keep-comment: isolateModules needs require
    mod = { ...require("../recording-diagnostics"), redact: require("../logger").redact };
  });
  if (!mod) throw new Error("expected the module");
  return mod;
}

describe("recordingEnvironment", () => {
  beforeEach(() => {
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: "granted", android: { accuracy: "coarse" } });
    location.getBackgroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    location.getProviderStatusAsync.mockResolvedValue({
      locationServicesEnabled: true,
      backgroundModeEnabled: true,
      gpsAvailable: false,
      networkAvailable: true,
    });
  });

  it("reports permissions, location services and power saving", async () => {
    const { recordingEnvironment } = load({
      getBatteryLevelAsync: jest.fn().mockResolvedValue(0.234),
      isLowPowerModeEnabledAsync: jest.fn().mockResolvedValue(true),
      isBatteryOptimizationEnabledAsync: jest.fn().mockResolvedValue(true),
    });

    expect(await recordingEnvironment()).toEqual({
      foregroundPermission: "granted",
      backgroundPermission: "denied",
      accuracyGrant: "coarse",
      positioningEnabled: true,
      gpsAvailable: false,
      networkProviderAvailable: true,
      lowPowerMode: true,
      batteryOptimization: true,
      batteryPercent: 23,
    });
  });

  it("survives the logger's redaction with every field intact", async () => {
    const { recordingEnvironment, redact } = load({
      getBatteryLevelAsync: jest.fn().mockResolvedValue(0.5),
      isLowPowerModeEnabledAsync: jest.fn().mockResolvedValue(false),
      isBatteryOptimizationEnabledAsync: jest.fn().mockResolvedValue(false),
    });

    const environment = await recordingEnvironment();

    expect(redact(environment)).toEqual(environment);
  });

  it("says unknown on a binary built without the battery module", async () => {
    const { recordingEnvironment } = load("missing");

    const environment = await recordingEnvironment();

    expect(environment.lowPowerMode).toBe("unknown");
    expect(environment.foregroundPermission).toBe("granted");
  });

  it("says unknown for a reading that throws instead of failing the rest", async () => {
    location.getProviderStatusAsync.mockRejectedValue(new Error("no provider"));
    const { recordingEnvironment } = load(
      {
        getBatteryLevelAsync: jest.fn().mockResolvedValue(-1),
        isLowPowerModeEnabledAsync: jest.fn().mockResolvedValue(false),
      },
      "ios",
    );

    const environment = await recordingEnvironment();

    expect(environment.positioningEnabled).toBe("unknown");
    expect(environment.batteryPercent).toBe("unknown");
    expect(environment.batteryOptimization).toBeUndefined();
    expect(environment.lowPowerMode).toBe(false);
  });
});
