import CoordinateParser from "../coordinate-parser";

describe("CoordinateParser", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("parses a valid array of coordinates into GeoJSON positions ([lng, lat])", () => {
    const data = JSON.stringify([
      { latitude: 57.7, longitude: 12.0 },
      { latitude: 57.8, longitude: 12.1 },
    ]);
    const result = CoordinateParser({ data, identifier: "trail-1" });
    expect(result).toEqual([
      [12.0, 57.7],
      [12.1, 57.8],
    ]);
  });

  it("parses an empty array", () => {
    const result = CoordinateParser({ data: "[]", identifier: "trail-1" });
    expect(result).toEqual([]);
  });

  it("returns an empty array and warns on invalid JSON", () => {
    const result = CoordinateParser({ data: "not-json", identifier: "trail-1" });
    expect(result).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("trail-1"), expect.anything());
  });

  it("returns an empty array and warns on empty string", () => {
    const result = CoordinateParser({ data: "", identifier: "trail-abc" });
    expect(result).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("returns an empty array and warns when the payload is not an array", () => {
    const result = CoordinateParser({ data: JSON.stringify({ latitude: 57.7, longitude: 12.0 }), identifier: "t" });
    expect(result).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("t"));
  });

  it("drops points with missing or non-finite coordinates instead of emitting NaN", () => {
    const data = JSON.stringify([
      { latitude: 57.7, longitude: 12.0 },
      { latitude: 57.8 }, // missing longitude
      { longitude: 12.2 }, // missing latitude
      { latitude: "57.9", longitude: 12.3 }, // wrong type
      { latitude: Number.NaN, longitude: 12.4 },
      null,
      { latitude: 58.0, longitude: 12.5 },
    ]);

    const result = CoordinateParser({ data, identifier: "trail-1" });

    expect(result).toEqual([
      [12.0, 57.7],
      [12.5, 58.0],
    ]);
  });

  it("keeps valid zero coordinates", () => {
    const result = CoordinateParser({ data: JSON.stringify([{ latitude: 0, longitude: 0 }]), identifier: "t" });
    expect(result).toEqual([[0, 0]]);
  });
});
