import getBoundsFromTrail from "../get-bounds-from-trail";

describe("getBoundsFromTrail", () => {
  it("returns null for an empty input", () => {
    expect(getBoundsFromTrail([])).toBeNull();
  });

  it("returns a zero-area box for a single coordinate", () => {
    // GeoJSON positions are [longitude, latitude]
    expect(getBoundsFromTrail([[12.0, 57.7]])).toEqual([12.0, 57.7, 12.0, 57.7]);
  });

  it("computes [west, south, east, north] from multiple coordinates", () => {
    const bounds = getBoundsFromTrail([
      [12.0, 57.0],
      [13.0, 58.0],
    ]);
    expect(bounds).toEqual([12.0, 57.0, 13.0, 58.0]);
  });

  it("handles unordered coordinates", () => {
    const bounds = getBoundsFromTrail([
      [13.0, 58.0],
      [11.0, 56.0],
      [12.0, 57.0],
    ]);
    expect(bounds).toEqual([11.0, 56.0, 13.0, 58.0]);
  });
});
