import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrailPathBounds } from "@/api/map-markers";
import { TrailPathLite } from "@/data/types";

const CACHE_VERSION = "v2";
const CACHE_PREFIX = `@stigvidd_map_paths_${CACHE_VERSION}`;
// Keys written before versioning was added — safe to wipe on prune.
const LEGACY_CACHE_PREFIX = "@stigvidd_map_paths_L";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  data: TrailPathLite[];
  cachedAt: number;
}

// Grid cell sizes (in degrees) per LOD level. A larger cell means fewer unique
// cache keys, so more panning is covered by a single cached response.
// Level 0 has no entry — paths are not fetched at that zoom.
const GRID_SIZES: Record<1 | 2 | 3, number> = {
  1: 0.1,   // ~11 km — city-scale view
  2: 0.02,  // ~2.2 km — neighbourhood view
  3: 0.005, // ~550 m — trail-detail view
};

// Maps the map's latitudeDelta (viewport height in degrees) to an LOD level.
// Level 0 means too zoomed out to show paths at all.
export function getZoomLevel(latitudeDelta: number): 0 | 1 | 2 | 3 {
  if (latitudeDelta > 0.3) return 0;
  if (latitudeDelta > 0.05) return 1;
  if (latitudeDelta > 0.01) return 2;
  return 3;
}

// Snaps a coordinate down to the nearest grid boundary.
// toFixed(4) avoids floating-point drift in cache keys (e.g. 57.699999... → 57.7).
function snapDown(value: number, gridSize: number): number {
  return +(Math.floor(value / gridSize) * gridSize).toFixed(4);
}

function snapUp(value: number, gridSize: number): number {
  return +(Math.ceil(value / gridSize) * gridSize).toFixed(4);
}

// Aligns a viewport bounding box to the LOD grid so that small panning
// movements within the same grid cell produce an identical cache key.
export function snapBounds(bounds: TrailPathBounds, level: number): TrailPathBounds {
  const g = GRID_SIZES[level as 1 | 2 | 3] ?? GRID_SIZES[1];
  return {
    minLat: snapDown(bounds.minLat, g),
    minLon: snapDown(bounds.minLon, g),
    maxLat: snapUp(bounds.maxLat, g),
    maxLon: snapUp(bounds.maxLon, g),
  };
}

function cacheKey(snapped: TrailPathBounds, level: number): string {
  return `${CACHE_PREFIX}_L${level}_${snapped.minLat}_${snapped.minLon}_${snapped.maxLat}_${snapped.maxLon}`;
}

export async function getCachedPaths(bounds: TrailPathBounds, level: number): Promise<TrailPathLite[] | null> {
  if (!(level in GRID_SIZES)) return null;
  try {
    const snapped = snapBounds(bounds, level as 1 | 2 | 3);
    const raw = await AsyncStorage.getItem(cacheKey(snapped, level));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt >= TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCachedPaths(bounds: TrailPathBounds, level: number, data: TrailPathLite[]): Promise<void> {
  if (!(level in GRID_SIZES)) return;
  try {
    const snapped = snapBounds(bounds, level as 1 | 2 | 3);
    const entry: CacheEntry = { data, cachedAt: Date.now() };
    await AsyncStorage.setItem(cacheKey(snapped, level), JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
}

// Removes legacy (unversioned) keys and any versioned keys past their TTL.
// Call once at app startup — runs entirely in the background.
export async function pruneTrailPathCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const now = Date.now();
    const toDelete: string[] = [];

    for (const key of allKeys) {
      if (key.startsWith(LEGACY_CACHE_PREFIX)) {
        toDelete.push(key);
        continue;
      }
      if (!key.startsWith(CACHE_PREFIX)) continue;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) { toDelete.push(key); continue; }
        const entry = JSON.parse(raw) as CacheEntry;
        if (Date.now() - entry.cachedAt >= TTL_MS) toDelete.push(key);
      } catch {
        toDelete.push(key);
      }
    }

    if (toDelete.length > 0) await AsyncStorage.multiRemove(toDelete);
  } catch {
    // Non-fatal — cache prune is best-effort
  }
}
