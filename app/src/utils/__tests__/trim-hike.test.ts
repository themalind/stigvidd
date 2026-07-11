import { Segment } from "@/data/types";
import { flattenSegments, recomputeTrimmedHike } from "@/utils/trim-hike";

// Builds a segment from [lat, lng, timeStamp] tuples.
function segment(points: [number, number, number][]): Segment {
  const coordinates = points.map(([latitude, longitude, timeStamp]) => ({
    data: { latitude, longitude },
    timeStamp,
  }));
  return { coordinates, distance: 0, startTime: points[0]?.[2] ?? 0 };
}

// ~111m north per 0.001 latitude; spaced so distances are comfortably non-zero.
const oneSegment: Segment[] = [
  segment([
    [57.0, 12.0, 1000],
    [57.001, 12.0, 4000],
    [57.002, 12.0, 7000],
    [57.003, 12.0, 10000],
  ]),
];

describe("recomputeTrimmedHike", () => {
  it("returns zeros for an empty hike", () => {
    expect(recomputeTrimmedHike([], 0, 10)).toEqual({ coordinates: [], distance: 0, duration: 0 });
  });

  it("keeps the whole route when the range spans every point", () => {
    const result = recomputeTrimmedHike(oneSegment, 0, 3);
    expect(result.coordinates).toHaveLength(4);
    // Duration is last timestamp minus first.
    expect(result.duration).toBe(9000);
    expect(result.distance).toBeGreaterThan(0);
  });

  it("drops trailing points and their distance/time when the end is trimmed", () => {
    const full = recomputeTrimmedHike(oneSegment, 0, 3);
    const trimmed = recomputeTrimmedHike(oneSegment, 0, 1);

    expect(trimmed.coordinates).toHaveLength(2);
    expect(trimmed.duration).toBe(3000); // 4000 - 1000
    expect(trimmed.distance).toBeLessThan(full.distance);
  });

  it("drops leading points when the start is trimmed", () => {
    const trimmed = recomputeTrimmedHike(oneSegment, 2, 3);
    expect(trimmed.coordinates).toHaveLength(2);
    expect(trimmed.duration).toBe(3000); // 10000 - 7000
  });

  it("clamps and orders out-of-range indices", () => {
    const result = recomputeTrimmedHike(oneSegment, -5, 99);
    expect(result.coordinates).toHaveLength(4);
    expect(result.duration).toBe(9000);
  });

  it("rounds duration to a whole number so iOS fractional-ms timestamps stay int-safe", () => {
    // iOS reports location.timestamp with fractional milliseconds; the backend's
    // Duration is an int, so a non-integer duration is rejected (400) on save.
    const iosSegment: Segment[] = [
      segment([
        [57.0, 12.0, 1000.1],
        [57.001, 12.0, 4000.2],
      ]),
    ];
    const result = recomputeTrimmedHike(iosSegment, 0, 1);
    expect(Number.isInteger(result.duration)).toBe(true);
    expect(result.duration).toBe(3000); // Math.round(4000.2 - 1000.1)
  });

  it("does not count the pause gap between segments as distance or time", () => {
    // Two segments far apart in space and time (a long pause between them).
    const segments: Segment[] = [
      segment([
        [57.0, 12.0, 1000],
        [57.001, 12.0, 3000],
      ]),
      segment([
        [58.0, 13.0, 600000], // far away, ~10 min later
        [58.001, 13.0, 602000],
      ]),
    ];

    const result = recomputeTrimmedHike(segments, 0, 3);

    // Duration = each segment's own span, never the 10-minute pause between them.
    expect(result.duration).toBe(2000 + 2000);

    // Distance must exclude the huge inter-segment jump: it equals the sum of the
    // two within-segment legs, not the leg crossing from segment 0 to segment 1.
    const within =
      recomputeTrimmedHike([segments[0]], 0, 1).distance + recomputeTrimmedHike([segments[1]], 0, 1).distance;
    expect(result.distance).toBe(within);
  });
});

describe("flattenSegments", () => {
  it("tags each point with its source segment in order", () => {
    const segments: Segment[] = [
      segment([
        [57.0, 12.0, 1000],
        [57.001, 12.0, 2000],
      ]),
      segment([[58.0, 13.0, 3000]]),
    ];

    const flat = flattenSegments(segments);
    expect(flat.map((p) => p.segment)).toEqual([0, 0, 1]);
    expect(flat).toHaveLength(3);
  });
});
