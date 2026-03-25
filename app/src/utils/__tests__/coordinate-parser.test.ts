import CoordinateParser from "../coordinate-parser";

describe("CoordinateParser", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("parses a valid array of coordinates", () => {
    const data = JSON.stringify([
      { latitude: 57.7, longitude: 12.0 },
      { latitude: 57.8, longitude: 12.1 },
    ]);
    const result = CoordinateParser({ data, identifier: "trail-1" });
    expect(result).toEqual([
      { latitude: 57.7, longitude: 12.0 },
      { latitude: 57.8, longitude: 12.1 },
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
});
