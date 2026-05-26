import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCachedPaths, getZoomLevel, setCachedPaths, snapBounds } from "../trail-path-cache";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

const baseBounds = { minLat: 57.65, minLon: 12.85, maxLat: 57.75, maxLon: 12.95 };

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

describe("snapBounds", () => {
  it("snaps to 0.1° grid at level 1", () => {
    const result = snapBounds(baseBounds, 1);
    // 57.65 → floor to 57.6; 57.75 → ceil to 57.8
    // 12.85 → floor to 12.8; 12.95 → ceil to 13
    expect(result.minLat).toBe(57.6);
    expect(result.maxLat).toBe(57.8);
    expect(result.minLon).toBe(12.8);
    expect(result.maxLon).toBe(13);
  });

  it("snaps to 0.02° grid at level 2", () => {
    const result = snapBounds({ minLat: 57.63, minLon: 12.83, maxLat: 57.67, maxLon: 12.87 }, 2);
    // 57.63 → floor to 57.62; 57.67 → ceil to 57.68
    // 12.83 → floor to 12.82; 12.87 → ceil to 12.88
    expect(result.minLat).toBe(57.62);
    expect(result.maxLat).toBe(57.68);
    expect(result.minLon).toBe(12.82);
    expect(result.maxLon).toBe(12.88);
  });

  it("snaps to 0.005° grid at level 3", () => {
    const result = snapBounds({ minLat: 57.623, minLon: 12.803, maxLat: 57.627, maxLon: 12.807 }, 3);
    // 57.623 → floor to 57.62; 57.627 → ceil to 57.63
    expect(result.minLat).toBe(57.62);
    expect(result.maxLat).toBe(57.63);
  });

  it("returns identical bounds when input is already aligned to the grid", () => {
    const aligned = { minLat: 57.6, minLon: 12.8, maxLat: 57.8, maxLon: 13 };
    const result = snapBounds(aligned, 1);
    expect(result).toEqual(aligned);
  });

  it("two pans within the same grid cell produce the same snapped bounds", () => {
    const panA = { minLat: 57.61, minLon: 12.81, maxLat: 57.71, maxLon: 12.91 };
    const panB = { minLat: 57.65, minLon: 12.85, maxLat: 57.75, maxLon: 12.95 };
    expect(snapBounds(panA, 1)).toEqual(snapBounds(panB, 1));
  });

  it("unknown level falls back to the 0.1° grid (same as level 1)", () => {
    expect(snapBounds(baseBounds, 0)).toEqual(snapBounds(baseBounds, 1));
  });

  it("does not produce floating-point drift in computed grid boundaries", () => {
    // 577 * 0.1 = 57.699999999999996 in IEEE 754 — toFixed(4) normalises this to 57.7
    // so a value in [57.7, 57.8) must snap to exactly 57.7, not 57.699999...
    const bounds = { minLat: 57.71, minLon: 12.81, maxLat: 57.79, maxLon: 12.89 };
    const result = snapBounds(bounds, 1);
    expect(result.minLat).toBe(57.7);
    expect(result.maxLat).toBe(57.8);
  });
});

describe("getCachedPaths", () => {
  it("returns null on cache miss", async () => {
    mockGetItem.mockResolvedValue(null);
    const result = await getCachedPaths(baseBounds, 1);
    expect(result).toBeNull();
  });

  it("returns parsed paths on cache hit", async () => {
    const paths = [{ identifier: "trail-abc", path: [{ latitude: 57.6, longitude: 12.8 }] }];
    mockGetItem.mockResolvedValue(JSON.stringify(paths));

    const result = await getCachedPaths(baseBounds, 1);
    expect(result).toEqual(paths);
  });

  it("returns null for level 0 without touching AsyncStorage", async () => {
    const result = await getCachedPaths(baseBounds, 0);
    expect(result).toBeNull();
    expect(mockGetItem).not.toHaveBeenCalled();
  });

  it("queries AsyncStorage with a key derived from the snapped bounds", async () => {
    mockGetItem.mockResolvedValue(null);
    // baseBounds snaps to { minLat: 57.6, minLon: 12.8, maxLat: 57.8, maxLon: 13 } at level 1
    await getCachedPaths(baseBounds, 1);
    expect(mockGetItem).toHaveBeenCalledWith("@stigvidd_map_paths_L1_57.6_12.8_57.8_13");
  });

  it("returns null on storage read error", async () => {
    mockGetItem.mockRejectedValue(new Error("storage error"));
    const result = await getCachedPaths(baseBounds, 1);
    expect(result).toBeNull();
  });

  it("returns null when cached value contains malformed JSON", async () => {
    mockGetItem.mockResolvedValue("not-valid-json{{{");
    const result = await getCachedPaths(baseBounds, 1);
    expect(result).toBeNull();
  });

  it("queries AsyncStorage with a level-2 key derived from the snapped bounds", async () => {
    mockGetItem.mockResolvedValue(null);
    const bounds = { minLat: 57.63, minLon: 12.83, maxLat: 57.67, maxLon: 12.87 };
    // snapped at 0.02°: minLat=57.62, minLon=12.82, maxLat=57.68, maxLon=12.88
    await getCachedPaths(bounds, 2);
    expect(mockGetItem).toHaveBeenCalledWith("@stigvidd_map_paths_L2_57.62_12.82_57.68_12.88");
  });

  it("queries AsyncStorage with a level-3 key derived from the snapped bounds", async () => {
    mockGetItem.mockResolvedValue(null);
    const bounds = { minLat: 57.623, minLon: 12.803, maxLat: 57.627, maxLon: 12.807 };
    // snapped at 0.005°: minLat=57.62, minLon=12.8, maxLat=57.63, maxLon=12.81
    await getCachedPaths(bounds, 3);
    expect(mockGetItem).toHaveBeenCalledWith("@stigvidd_map_paths_L3_57.62_12.8_57.63_12.81");
  });
});

describe("setCachedPaths", () => {
  it("stores paths under the snapped-bounds cache key", async () => {
    const paths = [{ identifier: "trail-abc", path: [] }];
    await setCachedPaths(baseBounds, 1, paths);
    expect(mockSetItem).toHaveBeenCalledWith(
      "@stigvidd_map_paths_L1_57.6_12.8_57.8_13",
      JSON.stringify(paths)
    );
  });

  it("does nothing for level 0", async () => {
    await setCachedPaths(baseBounds, 0, []);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("silently ignores storage write errors", async () => {
    mockSetItem.mockRejectedValue(new Error("disk full"));
    await expect(setCachedPaths(baseBounds, 1, [])).resolves.toBeUndefined();
  });
});
