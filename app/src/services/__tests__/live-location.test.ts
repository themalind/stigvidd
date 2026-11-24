// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

type LiveLocation = typeof import("../live-location");

const warn = jest.fn();
const requireNativeModule = jest.fn();

function load(os: "android" | "ios"): LiveLocation {
  let mod: LiveLocation | undefined;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: os } }));
    jest.doMock("expo", () => ({ requireNativeModule: (name: string) => requireNativeModule(name) }));
    jest.doMock("../logger", () => ({ logger: { warn } }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- keep-comment: isolateModules needs require
    mod = require("../live-location");
  });
  if (!mod) throw new Error("expected the module");
  return mod;
}

const FIX = { latitude: 57.72, longitude: 12.94, accuracy: 5, timestamp: 1 };

function nativeModule(available = true) {
  return {
    isAvailable: jest.fn().mockReturnValue(available),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    drain: jest.fn().mockResolvedValue([FIX]),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("on iOS with the native module", () => {
  it("passes every call through to it", async () => {
    const native = nativeModule();
    requireNativeModule.mockReturnValue(native);
    const live = load("ios");
    const listener = jest.fn();

    expect(live.isLiveLocationAvailable()).toBe(true);
    await live.startLiveLocation();
    await live.stopLiveLocation();
    expect(await live.drainLiveLocation()).toEqual([FIX]);
    expect(live.addLiveLocationListener(listener)).not.toBeNull();

    expect(requireNativeModule).toHaveBeenCalledWith("ExpoLiveLocation");
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(native.stop).toHaveBeenCalledTimes(1);
    expect(native.addListener).toHaveBeenCalledWith("onLocation", listener);
  });

  it("reports unavailable on an iOS older than 18", () => {
    requireNativeModule.mockReturnValue(nativeModule(false));

    expect(load("ios").isLiveLocationAvailable()).toBe(false);
  });
});

describe("falling back to expo-location", () => {
  it("logs and does nothing when the module fails to load on iOS", async () => {
    requireNativeModule.mockImplementation(() => {
      throw new Error("Cannot find native module 'ExpoLiveLocation'");
    });
    const live = load("ios");

    expect(live.isLiveLocationAvailable()).toBe(false);
    await expect(live.startLiveLocation()).resolves.toBeUndefined();
    expect(await live.drainLiveLocation()).toEqual([]);
    expect(live.addLiveLocationListener(jest.fn())).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Native live-location module failed to load"),
      expect.objectContaining({ reason: "module_load_failed" }),
    );
  });

  it("never looks for the module on Android, and logs nothing", async () => {
    const live = load("android");

    expect(live.isLiveLocationAvailable()).toBe(false);
    await expect(live.stopLiveLocation()).resolves.toBeUndefined();
    expect(await live.drainLiveLocation()).toEqual([]);
    expect(live.addLiveLocationListener(jest.fn())).toBeNull();
    expect(requireNativeModule).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
