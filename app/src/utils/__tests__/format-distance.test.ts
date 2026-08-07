import { formatDistanceKm } from "@/utils/format-distance";

describe("formatDistanceKm", () => {
  it("shows metres below one kilometre", () => {
    expect(formatDistanceKm(0.45)).toBe("450 m");
  });

  it("rounds metres to the nearest ten", () => {
    expect(formatDistanceKm(0.447)).toBe("450 m");
  });

  it("promotes to kilometres when rounding reaches 1000 metres", () => {
    expect(formatDistanceKm(0.995)).toBe("1,0 km");
  });

  it("uses a Swedish decimal comma", () => {
    expect(formatDistanceKm(3.24)).toBe("3,2 km");
  });

  it("drops the decimal above ten kilometres", () => {
    expect(formatDistanceKm(127.4)).toBe("127 km");
  });

  it("handles zero", () => {
    expect(formatDistanceKm(0)).toBe("0 m");
  });
});
