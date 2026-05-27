import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getZoomLevel,
  getTilesForBounds,
  tileBounds,
  getCachedTiles,
  setTileCached,
  mergePathTiles,
  pruneTrailPathCache,
  TileCoord,
} from "../trail-path-cache";
import { TrailPathLite } from "@/data/types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  getAllKeys: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetAllKeys = AsyncStorage.getAllKeys as jest.Mock;
const mockMultiRemove = AsyncStorage.multiRemove as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getZoomLevel", () => {
  it("returns 0 when latitudeDelta is above 0.3", () => {
    expect(getZoomLevel(0.4)).toBe(0);
    expect(getZoomLevel(1.0)).toBe(0);
  });

  it("returns 1 when latitudeDelta is between 0.05 and 0.3 (inclusive of 0.3)", () => {
    expect(getZoomLevel(0.3)).toBe(1);
    expect(getZoomLevel(0.15)).toBe(1);
    expect(getZoomLevel(0.06)).toBe(1);
  });

  it("returns 2 when latitudeDelta is between 0.01 and 0.05 (inclusive of 0.05)", () => {
    expect(getZoomLevel(0.05)).toBe(2);
    expect(getZoomLevel(0.03)).toBe(2);
    expect(getZoomLevel(0.011)).toBe(2);
  });

  it("returns 3 when latitudeDelta is 0.01 or below", () => {
    expect(getZoomLevel(0.01)).toBe(3);
    expect(getZoomLevel(0.005)).toBe(3);
    expect(getZoomLevel(0.001)).toBe(3);
  });
});

describe("getTilesForBounds", () => {
  it("returns a single tile when bounds fit entirely within one grid cell at level 1", () => {
    // floor(12.81/0.1)=128, floor(12.89/0.1)=128 → x: [128]
    // floor(57.61/0.1)=576, floor(57.69/0.1)=576 → y: [576]
    const bounds = { minLat: 57.61, minLon: 12.81, maxLat: 57.69, maxLon: 12.89 };
    expect(getTilesForBounds(bounds, 1)).toEqual([{ x: 128, y: 576 }]);
  });

  it("returns four tiles when bounds span a 2×2 grid intersection at level 1", () => {
    // floor(12.85/0.1)=128, floor(12.95/0.1)=129 → x: 128, 129
    // floor(57.65/0.1)=576, floor(57.75/0.1)=577 → y: 576, 577
    const bounds = { minLat: 57.65, minLon: 12.85, maxLat: 57.75, maxLon: 12.95 };
    const tiles = getTilesForBounds(bounds, 1);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ x: 128, y: 576 });
    expect(tiles).toContainEqual({ x: 128, y: 577 });
    expect(tiles).toContainEqual({ x: 129, y: 576 });
    expect(tiles).toContainEqual({ x: 129, y: 577 });
  });

  it("returns a single tile for a tight viewport at level 2", () => {
    // floor(12.821/0.02)=641, floor(12.829/0.02)=641 → x: [641]
    // floor(57.631/0.02)=2881, floor(57.639/0.02)=2881 → y: [2881]
    const bounds = { minLat: 57.631, minLon: 12.821, maxLat: 57.639, maxLon: 12.829 };
    expect(getTilesForBounds(bounds, 2)).toEqual([{ x: 641, y: 2881 }]);
  });

  it("returns a single tile for a tight viewport at level 3", () => {
    // floor(12.803/0.005)=2560, floor(12.804/0.005)=2560 → x: [2560]
    // floor(57.623/0.005)=11524, floor(57.624/0.005)=11524 → y: [11524]
    const bounds = { minLat: 57.623, minLon: 12.803, maxLat: 57.624, maxLon: 12.804 };
    expect(getTilesForBounds(bounds, 3)).toEqual([{ x: 2560, y: 11524 }]);
  });
});

describe("tileBounds", () => {
  it("returns correct bounding box for a level-1 tile", () => {
    // 128*0.1→12.8, 129*0.1→12.9, 576*0.1→57.6, 577*0.1→57.7 (all exact after toFixed(6))
    const result = tileBounds(128, 576, 1);
    expect(result.minLon).toBe(12.8);
    expect(result.maxLon).toBe(12.9);
    expect(result.minLat).toBe(57.6);
    expect(result.maxLat).toBe(57.7);
  });

  it("returns correct bounding box for a level-2 tile", () => {
    // 641*0.02=12.82, 642*0.02=12.84, 2881*0.02=57.62, 2882*0.02=57.64
    const result = tileBounds(641, 2881, 2);
    expect(result.minLon).toBe(12.82);
    expect(result.maxLon).toBe(12.84);
    expect(result.minLat).toBe(57.62);
    expect(result.maxLat).toBe(57.64);
  });

  it("returns correct bounding box for a level-3 tile", () => {
    // 2560*0.005=12.8, 2561*0.005=12.805, 11524*0.005=57.62, 11525*0.005=57.625
    const result = tileBounds(2560, 11524, 3);
    expect(result.minLon).toBe(12.8);
    expect(result.maxLon).toBe(12.805);
    expect(result.minLat).toBe(57.62);
    expect(result.maxLat).toBe(57.625);
  });

  it("round-trips with getTilesForBounds: a point strictly inside tileBounds returns only that tile", () => {
    const x = 128,
      y = 576;
    const b = tileBounds(x, y, 1);
    const inner = {
      minLat: b.minLat + 0.01,
      maxLat: b.maxLat - 0.01,
      minLon: b.minLon + 0.01,
      maxLon: b.maxLon - 0.01,
    };
    expect(getTilesForBounds(inner, 1)).toEqual([{ x, y }]);
  });
});

// Each getCachedTiles / setTileCached test uses unique tile coordinates because the
// module-level memCache is not reset between tests. Unique coords prevent cross-test hits.
describe("getCachedTiles", () => {
  it("returns all tiles as misses when AsyncStorage returns null", async () => {
    mockGetItem.mockResolvedValue(null);
    const tiles: TileCoord[] = [
      { x: 1001, y: 1001 },
      { x: 1002, y: 1002 },
    ];
    const { hits, misses } = await getCachedTiles(tiles, 1);
    expect(hits.size).toBe(0);
    expect(misses).toHaveLength(2);
  });

  it("returns a hit when AsyncStorage has a valid cached entry", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-a", path: [] }];
    mockGetItem.mockResolvedValue(JSON.stringify({ data: paths, cachedAt: Date.now() }));
    const { hits, misses } = await getCachedTiles([{ x: 1003, y: 1003 }], 1);
    expect(hits.size).toBe(1);
    expect([...hits.values()][0]).toEqual(paths);
    expect(misses).toHaveLength(0);
  });

  it("treats an expired AsyncStorage entry (cachedAt=0) as a miss", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-b", path: [] }];
    mockGetItem.mockResolvedValue(JSON.stringify({ data: paths, cachedAt: 0 }));
    const { hits, misses } = await getCachedTiles([{ x: 1005, y: 1005 }], 1);
    expect(hits.size).toBe(0);
    expect(misses).toHaveLength(1);
  });

  it("treats a storage read error as a miss", async () => {
    mockGetItem.mockRejectedValue(new Error("storage error"));
    const { hits, misses } = await getCachedTiles([{ x: 1006, y: 1006 }], 1);
    expect(hits.size).toBe(0);
    expect(misses).toHaveLength(1);
  });

  it("treats malformed JSON in AsyncStorage as a miss", async () => {
    mockGetItem.mockResolvedValue("not-valid-json{{{");
    const { hits, misses } = await getCachedTiles([{ x: 1009, y: 1009 }], 1);
    expect(hits.size).toBe(0);
    expect(misses).toHaveLength(1);
  });

  it("returns a mix of hits and misses", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-c", path: [] }];
    mockGetItem
      .mockResolvedValueOnce(JSON.stringify({ data: paths, cachedAt: Date.now() }))
      .mockResolvedValueOnce(null);
    const tiles: TileCoord[] = [
      { x: 1007, y: 1007 },
      { x: 1008, y: 1008 },
    ];
    const { hits, misses } = await getCachedTiles(tiles, 1);
    expect(hits.size).toBe(1);
    expect(misses).toHaveLength(1);
  });

  it("promotes an AsyncStorage hit to memory cache so the second call skips storage", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-d", path: [] }];
    mockGetItem.mockResolvedValue(JSON.stringify({ data: paths, cachedAt: Date.now() }));
    const tile: TileCoord = { x: 1004, y: 1004 };

    await getCachedTiles([tile], 1);
    expect(mockGetItem).toHaveBeenCalledTimes(1);

    mockGetItem.mockClear();

    const { hits } = await getCachedTiles([tile], 1);
    expect(hits.size).toBe(1);
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});

describe("setTileCached", () => {
  it("writes to AsyncStorage under the correct tile key", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-e", path: [] }];
    await setTileCached(2001, 2001, 1, paths);
    expect(mockSetItem).toHaveBeenCalledWith(
      "@stigvidd_map_paths_v3_L1_T2001_2001",
      expect.stringContaining('"identifier":"trail-e"'),
    );
  });

  it("wraps the data in a { data, cachedAt } envelope with a recent timestamp", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-f", path: [] }];
    const before = Date.now();
    await setTileCached(2004, 2004, 1, paths);
    const after = Date.now();
    const raw = mockSetItem.mock.calls[0][1] as string;
    const entry = JSON.parse(raw);
    expect(entry.data).toEqual(paths);
    expect(entry.cachedAt).toBeGreaterThanOrEqual(before);
    expect(entry.cachedAt).toBeLessThanOrEqual(after);
  });

  it("silently ignores AsyncStorage write errors", async () => {
    mockSetItem.mockRejectedValue(new Error("disk full"));
    await expect(setTileCached(2002, 2002, 1, [])).resolves.toBeUndefined();
  });

  it("stores in memory cache so getCachedTiles returns a hit without touching AsyncStorage", async () => {
    const paths: TrailPathLite[] = [{ identifier: "trail-g", path: [] }];
    await setTileCached(2003, 2003, 1, paths);
    mockSetItem.mockClear();

    const { hits } = await getCachedTiles([{ x: 2003, y: 2003 }], 1);
    expect(hits.size).toBe(1);
    expect([...hits.values()][0]).toEqual(paths);
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});

describe("mergePathTiles", () => {
  it("returns an empty array for empty input", () => {
    expect(mergePathTiles([])).toEqual([]);
  });

  it("returns all paths when there are no duplicates across tiles", () => {
    const tile1: TrailPathLite[] = [{ identifier: "a", path: [] }];
    const tile2: TrailPathLite[] = [{ identifier: "b", path: [] }];
    const result = mergePathTiles([tile1, tile2]);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.identifier)).toEqual(["a", "b"]);
  });

  it("deduplicates trails that appear in multiple tiles", () => {
    const shared: TrailPathLite = { identifier: "shared", path: [] };
    const unique: TrailPathLite = { identifier: "unique", path: [] };
    const result = mergePathTiles([[shared, unique], [shared]]);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.identifier)).toContain("shared");
    expect(result.map((p) => p.identifier)).toContain("unique");
  });

  it("preserves the first occurrence when deduplicating", () => {
    const v1: TrailPathLite = { identifier: "trail", path: [{ latitude: 1, longitude: 1 }] };
    const v2: TrailPathLite = { identifier: "trail", path: [{ latitude: 2, longitude: 2 }] };
    const result = mergePathTiles([[v1], [v2]]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(v1);
  });

  it("handles tiles with empty arrays without error", () => {
    const result = mergePathTiles([[], [{ identifier: "a", path: [] }], []]);
    expect(result).toHaveLength(1);
    expect(result[0].identifier).toBe("a");
  });
});

describe("pruneTrailPathCache", () => {
  it("removes keys with the legacy L-format prefix", async () => {
    mockGetAllKeys.mockResolvedValue(["@stigvidd_map_paths_L1_57.6_12.8_57.7_12.9"]);
    await pruneTrailPathCache();
    expect(mockMultiRemove).toHaveBeenCalledWith(["@stigvidd_map_paths_L1_57.6_12.8_57.7_12.9"]);
  });

  it("removes keys with the legacy v2 prefix", async () => {
    mockGetAllKeys.mockResolvedValue(["@stigvidd_map_paths_v2_some_key"]);
    await pruneTrailPathCache();
    expect(mockMultiRemove).toHaveBeenCalledWith(["@stigvidd_map_paths_v2_some_key"]);
  });

  it("removes expired v3 tile entries", async () => {
    const expiredKey = "@stigvidd_map_paths_v3_L1_T128_576";
    mockGetAllKeys.mockResolvedValue([expiredKey]);
    mockGetItem.mockResolvedValue(JSON.stringify({ data: [], cachedAt: 0 }));
    await pruneTrailPathCache();
    expect(mockMultiRemove).toHaveBeenCalledWith([expiredKey]);
  });

  it("keeps unexpired v3 tile entries", async () => {
    const freshKey = "@stigvidd_map_paths_v3_L1_T200_200";
    mockGetAllKeys.mockResolvedValue([freshKey]);
    mockGetItem.mockResolvedValue(JSON.stringify({ data: [], cachedAt: Date.now() }));
    await pruneTrailPathCache();
    expect(mockMultiRemove).not.toHaveBeenCalled();
  });

  it("does not call multiRemove when there is nothing to delete", async () => {
    mockGetAllKeys.mockResolvedValue([]);
    await pruneTrailPathCache();
    expect(mockMultiRemove).not.toHaveBeenCalled();
  });

  it("handles getAllKeys errors gracefully without throwing", async () => {
    mockGetAllKeys.mockRejectedValue(new Error("storage unavailable"));
    await expect(pruneTrailPathCache()).resolves.toBeUndefined();
  });
});
