import GetRegionFromTrail from "../get-region-from-trail";

describe("GetRegionFromTrail", () => {
  it("centers on a single coordinate", () => {
    const result = GetRegionFromTrail([{ latitude: 57.7, longitude: 12.0 }]);
    expect(result.latitude).toBe(57.7);
    expect(result.longitude).toBe(12.0);
  });

  it("applies the minimum delta (0.01) when coords are identical", () => {
    const result = GetRegionFromTrail([
      { latitude: 57.7, longitude: 12.0 },
      { latitude: 57.7, longitude: 12.0 },
    ]);
    // min delta is 0.01, multiplied by 1.6
    expect(result.latitudeDelta).toBeCloseTo(0.01 * 1.6);
    expect(result.longitudeDelta).toBeCloseTo(0.01 * 1.6);
  });

  it("computes the correct center from multiple coords", () => {
    const result = GetRegionFromTrail([
      { latitude: 57.0, longitude: 12.0 },
      { latitude: 58.0, longitude: 13.0 },
    ]);
    expect(result.latitude).toBeCloseTo(57.5);
    expect(result.longitude).toBeCloseTo(12.5);
  });

  it("computes deltas with 1.6x padding", () => {
    const result = GetRegionFromTrail([
      { latitude: 57.0, longitude: 12.0 },
      { latitude: 58.0, longitude: 13.0 },
    ]);
    // lat spread = 1.0, lng spread = 1.0, both > 0.01
    expect(result.latitudeDelta).toBeCloseTo(1.0 * 1.6);
    expect(result.longitudeDelta).toBeCloseTo(1.0 * 1.6);
  });

  it("uses minimum delta when spread is smaller than 0.01", () => {
    const result = GetRegionFromTrail([
      { latitude: 57.7, longitude: 12.0 },
      { latitude: 57.7001, longitude: 12.0001 }, // ~11m spread, well under 0.01 deg
    ]);
    expect(result.latitudeDelta).toBeCloseTo(0.01 * 1.6);
    expect(result.longitudeDelta).toBeCloseTo(0.01 * 1.6);
  });

  it("handles many coordinates correctly", () => {
    const coords = [
      { latitude: 56.0, longitude: 11.0 },
      { latitude: 57.0, longitude: 12.0 },
      { latitude: 58.0, longitude: 13.0 },
      { latitude: 59.0, longitude: 14.0 },
    ];
    const result = GetRegionFromTrail(coords);
    expect(result.latitude).toBeCloseTo(57.5);
    expect(result.longitude).toBeCloseTo(12.5);
    expect(result.latitudeDelta).toBeCloseTo(3.0 * 1.6);
    expect(result.longitudeDelta).toBeCloseTo(3.0 * 1.6);
  });
});
