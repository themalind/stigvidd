import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineManager } from "@maplibre/maplibre-react-native";
import Constants from "expo-constants";
import { MAP_AMBIENT_CACHE_MAX_BYTES, MAP_CACHE_BUILD_KEY } from "@/constants/cache";

// MapLibre's local ambient tile-cache (SQLite) can intermittently corrupt itself,
// after which maplibre-native cancels every tile/glyph request ("permanent error:
// Canceled") and the map never recovers — it stays blank until the cache is wiped.
// The verified trigger is installing a new build over an old one: the previous
// build's cache is served and is in a bad state. Because the development and
// preview EAS profiles share the same package id (com.stigvidd.app), swapping
// between them is an in-place update that keeps — and thus serves — the other
// profile's stale cache. We keep the cache healthy with two best-effort helpers
// (mirroring `pruneTrailCardCache` / `loadStoredLanguage`): they never throw,
// since a cache reset must never block app start.

// Identifies the current build so we can detect "new build over old cache".
// - nativeBuildVersion bumps with every native build (and falls back to the JS
//   app version for dev/Expo Go where it's unavailable).
// - __DEV__ distinguishes the development build (dev client, true) from the
//   preview/production build (release, false). Both profiles ship the same
//   package id and the same versionCode, so without this a dev<->preview swap
//   would look like "same build" and skip the reset — exactly the corruption
//   we need to clear.
function getCurrentBuildId(): string {
  const nativeId = Constants.nativeBuildVersion ?? Constants.expoConfig?.version ?? "unknown";
  return `${nativeId}-${__DEV__ ? "dev" : "release"}`;
}

// Run once at app startup. On a new build (or first launch) it resets the cache
// database — the in-app equivalent of `pm clear`, which we verified fixes the
// blank map. On the same build it cheaply revalidates so a stale/bad entry isn't
// served, without throwing away an otherwise-warm cache.
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
    // Non-fatal — cache maintenance is best-effort and must never block startup.
  }
}
