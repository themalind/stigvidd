// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineManager } from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { MAP_AMBIENT_CACHE_MAX_BYTES, MAP_CACHE_BUILD_KEY } from "@/constants/cache";

// keep-comment: a new build over an old one serves a corrupt tile cache ("Canceled"), leaving the map blank for good
// keep-comment: dev and preview share a package id, so swapping between them counts as that too

// keep-comment: __DEV__ tells dev from preview, which share the package id and versionCode
function getCurrentBuildId(): string {
  const nativeId = Constants.nativeBuildVersion ?? Constants.expoConfig?.version ?? "unknown";
  return `${nativeId}-${__DEV__ ? "dev" : "release"}`;
}

export async function initMapCache(): Promise<void> {
  try {
    await OfflineManager.setMaximumAmbientCacheSize(MAP_AMBIENT_CACHE_MAX_BYTES);

    const currentBuild = getCurrentBuildId();
    const storedBuild = await AsyncStorage.getItem(MAP_CACHE_BUILD_KEY);

    if (storedBuild !== currentBuild) {
      await OfflineManager.resetDatabase();
      await AsyncStorage.setItem(MAP_CACHE_BUILD_KEY, currentBuild);
    } else {
      await OfflineManager.invalidateAmbientCache();
    }
  } catch {
    // keep-comment: cache upkeep must never block app start
  }
}
