import { haversineDistance, isNearTrail } from "../haversine";

describe("haversineDistance", () => {
  it("returns 0 when both points are identical", () => {
    expect(haversineDistance(57.7, 12.0, 57.7, 12.0)).toBe(0);
  });

  it("returns a positive distance between two different points", () => {
    const distance = haversineDistance(57.7, 12.0, 57.8, 12.1);
    expect(distance).toBeGreaterThan(0);
  });

  it("calculates a roughly correct distance (Gothenburg to Borås ~60km)", () => {
    // Gothenburg: 57.7089, 11.9746 — Borås: 57.7210, 12.9401
    const distance = haversineDistance(57.7089, 11.9746, 57.721, 12.9401);
    expect(distance).toBeGreaterThan(55000);
    expect(distance).toBeLessThan(65000);
  });

  it("is symmetric — same distance regardless of direction", () => {
    const d1 = haversineDistance(57.7, 12.0, 57.8, 12.1);
    const d2 = haversineDistance(57.8, 12.1, 57.7, 12.0);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe("isNearTrail", () => {
  const trailCoords = [
    { latitude: 57.7, longitude: 12.0 },
    { latitude: 57.71, longitude: 12.01 },
    { latitude: 57.72, longitude: 12.02 },
  ];

  it("returns true when user is within threshold of a trail point", () => {
    // Same as first trail point — distance is 0
    expect(isNearTrail(57.7, 12.0, trailCoords)).toBe(true);
  });

  it("returns true when user is within default 500m threshold", () => {
    // Very close to first trail point
    expect(isNearTrail(57.7005, 12.0005, trailCoords)).toBe(true);
  });

  it("returns false when user is far from all trail points", () => {
    // Stockholm, far from the trail coords above
    expect(isNearTrail(59.3293, 18.0686, trailCoords)).toBe(false);
  });

  it("returns false when trail has no coordinates", () => {
    expect(isNearTrail(57.7, 12.0, [])).toBe(false);
  });

  it("respects a custom threshold", () => {
    // ~100m away from first point — outside 50m threshold, inside 500m
    expect(isNearTrail(57.7009, 12.0, trailCoords, 50)).toBe(false);
    expect(isNearTrail(57.7009, 12.0, trailCoords, 500)).toBe(true);
  });
});
