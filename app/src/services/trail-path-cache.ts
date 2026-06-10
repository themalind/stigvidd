import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrailPathBounds } from "@/api/map-markers";
import { TrailPathLite } from "@/data/types";

const CACHE_VERSION = "v3";
const CACHE_PREFIX = `@stigvidd_map_paths_${CACHE_VERSION}`;
// Previous cache formats — wiped on prune so storage doesn't accumulate old layouts.
const LEGACY_PREFIXES = ["@stigvidd_map_paths_L", "@stigvidd_map_paths_v2"];
const TTL_MS = 24 * 60 * 60 * 1000;

export interface TileCoord {
  x: number;
  y: number;
}

interface CacheEntry {
  data: TrailPathLite[];
  cachedAt: number;
}

// L1: module-level in-memory cache — survives component remounts within a session,
// gives instant hits without the AsyncStorage async overhead.
// Capped at MAX_MEM_TILES; oldest entry is evicted when the limit is reached.
const MAX_MEM_TILES = 60;
const memCache = new Map<string, CacheEntry>();

function memSet(key: string, entry: CacheEntry): void {
  if (memCache.size >= MAX_MEM_TILES && !memCache.has(key)) {
    memCache.delete(memCache.keys().next().value!);
  }
  memCache.set(key, entry);
}

// Grid cell sizes (in degrees) per LOD level.
const GRID_SIZES: Record<1 | 2 | 3, number> = {
  1: 0.1, // ~11 km — city-scale view
  2: 0.02, // ~2.2 km — neighbourhood view
  3: 0.005, // ~550 m — trail-detail view
};

export function getZoomLevel(latitudeDelta: number): 0 | 1 | 2 | 3 {
  if (latitudeDelta > 0.3) return 0;
  if (latitudeDelta > 0.05) return 1;
  if (latitudeDelta > 0.01) return 2;
  return 3;
}

function tileKey(x: number, y: number, level: number): string {
  return `${CACHE_PREFIX}_L${level}_T${x}_${y}`;
}

// Returns the fixed bounding box of a tile in absolute coordinate space.
// A tile at (x, y) always covers the same geographic area regardless of viewport position.
export function tileBounds(x: number, y: number, level: 1 | 2 | 3): TrailPathBounds {
  const g = GRID_SIZES[level];
  return {
    minLat: +(y * g).toFixed(6),
    maxLat: +((y + 1) * g).toFixed(6),
    minLon: +(x * g).toFixed(6),
    maxLon: +((x + 1) * g).toFixed(6),
  };
}

// Returns all tiles that overlap a given viewport at the given LOD level.
export function getTilesForBounds(bounds: TrailPathBounds, level: 1 | 2 | 3): TileCoord[] {
  const g = GRID_SIZES[level];
  const tiles: TileCoord[] = [];
  for (let x = Math.floor(bounds.minLon / g); x <= Math.floor(bounds.maxLon / g); x++) {
    for (let y = Math.floor(bounds.minLat / g); y <= Math.floor(bounds.maxLat / g); y++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

async function getTileCached(x: number, y: number, level: number): Promise<TrailPathLite[] | null> {
  const key = tileKey(x, y, level);
  const now = Date.now();

  // L1 check
  const mem = memCache.get(key);
  if (mem && now - mem.cachedAt < TTL_MS) return mem.data;

  // L2 check
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (now - entry.cachedAt >= TTL_MS) return null;
    memSet(key, entry); // promote to L1
    return entry.data;
  } catch {
    return null;
  }
}

// Writes a tile to both L1 memory and L2 AsyncStorage.
export async function setTileCached(x: number, y: number, level: number, data: TrailPathLite[]): Promise<void> {
  const key = tileKey(x, y, level);
  const entry: CacheEntry = { data, cachedAt: Date.now() };
  memSet(key, entry);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
}

// Checks cache for all tiles in parallel. Returns hits (keyed by tile key) and misses.
export async function getCachedTiles(
  tiles: TileCoord[],
  level: 1 | 2 | 3,
): Promise<{ hits: Map<string, TrailPathLite[]>; misses: TileCoord[] }> {
  const hits = new Map<string, TrailPathLite[]>();
  const misses: TileCoord[] = [];

  await Promise.all(
    tiles.map(async ({ x, y }) => {
      const data = await getTileCached(x, y, level);
      if (data !== null) hits.set(tileKey(x, y, level), data);
      else misses.push({ x, y });
    }),
  );

  return { hits, misses };
}

// Merges path data from multiple tiles. Trails near tile boundaries appear in both
// adjacent tiles; deduplication by identifier ensures each trail is rendered once.
export function mergePathTiles(tileDatas: TrailPathLite[][]): TrailPathLite[] {
  const seen = new Set<string>();
  const result: TrailPathLite[] = [];
  for (const tile of tileDatas) {
    for (const path of tile) {
      if (!seen.has(path.identifier)) {
        seen.add(path.identifier);
        result.push(path);
      }
    }
  }
  return result;
}

// Removes legacy keys (old cache formats) and expired v3 tiles.
// Call once at app startup — runs entirely in the background.
export async function pruneTrailPathCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const now = Date.now();
    const toDelete: string[] = [];

    for (const key of allKeys) {
      if (LEGACY_PREFIXES.some((p) => key.startsWith(p))) {
        toDelete.push(key);
        continue;
      }
      if (!key.startsWith(CACHE_PREFIX)) continue;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) {
          toDelete.push(key);
          continue;
        }
        const entry = JSON.parse(raw) as CacheEntry;
        if (now - entry.cachedAt >= TTL_MS) toDelete.push(key);
      } catch {
        toDelete.push(key);
      }
    }

    if (toDelete.length > 0) await AsyncStorage.multiRemove(toDelete);
  } catch {
    // Non-fatal — prune is best-effort
  }
}
