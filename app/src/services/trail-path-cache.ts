import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrailPathBounds } from "@/api/map-markers";
import { TrailPathLite } from "@/data/types";

const CACHE_PREFIX = "@stigvidd_map_paths";

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

// Cache key encodes the full snapped bounding box and level to avoid collisions
// between cells at the same level or the same area at different levels.
function cacheKey(snapped: TrailPathBounds, level: number): string {
  return `${CACHE_PREFIX}_L${level}_${snapped.minLat}_${snapped.minLon}_${snapped.maxLat}_${snapped.maxLon}`;
}

export async function getCachedPaths(bounds: TrailPathBounds, level: number): Promise<TrailPathLite[] | null> {
  if (!(level in GRID_SIZES)) return null;
  try {
    const snapped = snapBounds(bounds, level as 1 | 2 | 3);
    const raw = await AsyncStorage.getItem(cacheKey(snapped, level));
    if (!raw) return null;
    return JSON.parse(raw) as TrailPathLite[];
  } catch {
    return null;
  }
}

export async function setCachedPaths(bounds: TrailPathBounds, level: number, data: TrailPathLite[]): Promise<void> {
  if (!(level in GRID_SIZES)) return;
  try {
    const snapped = snapBounds(bounds, level as 1 | 2 | 3);
    await AsyncStorage.setItem(cacheKey(snapped, level), JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}
