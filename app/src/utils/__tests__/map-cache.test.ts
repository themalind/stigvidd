// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { nativeBuildVersion: undefined, expoConfig: { version: undefined } },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineManager } from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { MAP_AMBIENT_CACHE_MAX_BYTES, MAP_CACHE_BUILD_KEY } from "@/constants/cache";
import { initMapCache } from "../map-cache";

const constants = Constants as unknown as {
  nativeBuildVersion: string | undefined;
  expoConfig: { version: string | undefined } | null;
};

const offline = OfflineManager as unknown as {
  setMaximumAmbientCacheSize: jest.Mock;
  invalidateAmbientCache: jest.Mock;
  resetDatabase: jest.Mock;
};

const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

// The build id is `<native build>-<dev|release>`, so both halves are set per test.
function givenBuild({
  nativeBuildVersion,
  version,
  dev,
}: {
  nativeBuildVersion?: string;
  version?: string;
  dev: boolean;
}) {
  constants.nativeBuildVersion = nativeBuildVersion;
  constants.expoConfig = { version };
  (global as unknown as { __DEV__: boolean }).__DEV__ = dev;
}

const realDev = (global as unknown as { __DEV__: boolean }).__DEV__;

beforeEach(() => {
  offline.setMaximumAmbientCacheSize.mockClear().mockResolvedValue(undefined);
  offline.invalidateAmbientCache.mockClear().mockResolvedValue(undefined);
  offline.resetDatabase.mockClear().mockResolvedValue(undefined);
  storage.getItem.mockReset().mockResolvedValue(null);
  storage.setItem.mockReset().mockResolvedValue(undefined);
  givenBuild({ nativeBuildVersion: "42", dev: false });
});

afterAll(() => {
  (global as unknown as { __DEV__: boolean }).__DEV__ = realDev;
});

describe("initMapCache", () => {
  it("caps the ambient cache at 50 MB", async () => {
    await initMapCache();
    expect(offline.setMaximumAmbientCacheSize).toHaveBeenCalledWith(MAP_AMBIENT_CACHE_MAX_BYTES);
    expect(MAP_AMBIENT_CACHE_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it("resets the database on first launch, when no build is stored", async () => {
    storage.getItem.mockResolvedValue(null);
    await initMapCache();
    expect(offline.resetDatabase).toHaveBeenCalledTimes(1);
    expect(offline.invalidateAmbientCache).not.toHaveBeenCalled();
  });

  it("records the build it reset for, under the cache build key", async () => {
    storage.getItem.mockResolvedValue(null);
    await initMapCache();
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "42-release");
  });

  it("reads the stored build from the same key it writes", async () => {
    await initMapCache();
    expect(storage.getItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY);
  });

  it("resets the database when the stored build is an older one", async () => {
    storage.getItem.mockResolvedValue("41-release");
    await initMapCache();
    expect(offline.resetDatabase).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "42-release");
  });

  it("only revalidates when the stored build is the current one", async () => {
    storage.getItem.mockResolvedValue("42-release");
    await initMapCache();
    expect(offline.invalidateAmbientCache).toHaveBeenCalledTimes(1);
    expect(offline.resetDatabase).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  // The dev and preview profiles ship the same package id and versionCode, so the
  // native build version alone reads a profile swap as "same build" and skips the reset.
  it("resets on a dev -> preview swap, where only the profile differs", async () => {
    givenBuild({ nativeBuildVersion: "42", dev: false });
    storage.getItem.mockResolvedValue("42-dev");
    await initMapCache();
    expect(offline.resetDatabase).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "42-release");
  });

  it("resets on a preview -> dev swap too", async () => {
    givenBuild({ nativeBuildVersion: "42", dev: true });
    storage.getItem.mockResolvedValue("42-release");
    await initMapCache();
    expect(offline.resetDatabase).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "42-dev");
  });

  it("falls back to the JS app version when there is no native build version", async () => {
    givenBuild({ nativeBuildVersion: undefined, version: "1.0.0", dev: true });
    await initMapCache();
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "1.0.0-dev");
  });

  it("falls back to 'unknown' when neither version is available", async () => {
    givenBuild({ nativeBuildVersion: undefined, version: undefined, dev: true });
    await initMapCache();
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "unknown-dev");
  });

  it("falls back to 'unknown' when there is no expo config at all", async () => {
    givenBuild({ nativeBuildVersion: undefined, dev: false });
    constants.expoConfig = null;
    await initMapCache();
    expect(storage.setItem).toHaveBeenCalledWith(MAP_CACHE_BUILD_KEY, "unknown-release");
  });

  describe("is best-effort and never blocks app start", () => {
    it("swallows a failing cache-size call", async () => {
      offline.setMaximumAmbientCacheSize.mockRejectedValue(new Error("no native module"));
      await expect(initMapCache()).resolves.toBeUndefined();
    });

    it("swallows a failing storage read", async () => {
      storage.getItem.mockRejectedValue(new Error("storage unavailable"));
      await expect(initMapCache()).resolves.toBeUndefined();
    });

    it("swallows a failing reset", async () => {
      offline.resetDatabase.mockRejectedValue(new Error("database locked"));
      await expect(initMapCache()).resolves.toBeUndefined();
    });

    it("swallows a failing revalidation", async () => {
      storage.getItem.mockResolvedValue("42-release");
      offline.invalidateAmbientCache.mockRejectedValue(new Error("database locked"));
      await expect(initMapCache()).resolves.toBeUndefined();
    });

    // Recording a build the reset never completed for would skip the reset on the next
    // launch, leaving the corrupt cache in place for good.
    it("does not record the build when the reset failed", async () => {
      offline.resetDatabase.mockRejectedValue(new Error("database locked"));
      await initMapCache();
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  });
});
