import { LatLng, Segment } from "@/data/types";
import { getDistance } from "geolib";

export type TrimmedHike = {
  coordinates: LatLng[];
  distance: number; // meters
  duration: number; // milliseconds
};

type FlatPoint = { data: LatLng; timeStamp: number; segment: number };

// Flattens a hike's segments into a single ordered list of points, tagging each
// with the index of the segment it came from. The segment tag lets the trim
// recompute avoid treating a pause gap (the jump between two segments) as travel.
export function flattenSegments(segments: Segment[]): FlatPoint[] {
  const flat: FlatPoint[] = [];
  segments.forEach((seg, segment) => {
    seg.coordinates.forEach((c) => flat.push({ data: c.data, timeStamp: c.timeStamp, segment }));
  });
  return flat;
}

// Recomputes a hike restricted to the [startIndex, endIndex] window (inclusive)
// over the flattened coordinate list — the model behind "trim the start/end".
//
// - distance sums only consecutive kept points from the same original segment, so
//   the gap between two paused segments is never counted as travelled.
// - duration sums each segment's kept span (lastKept - firstKept), which naturally
//   excludes time the user was paused between segments.
//
// Indices are clamped to the valid range and ordered, so callers can pass raw
// slider values without guarding the edges.
export function recomputeTrimmedHike(segments: Segment[], startIndex: number, endIndex: number): TrimmedHike {
  const flat = flattenSegments(segments);
  if (flat.length === 0) return { coordinates: [], distance: 0, duration: 0 };

  const start = Math.max(0, Math.min(startIndex, flat.length - 1));
  const end = Math.max(start, Math.min(endIndex, flat.length - 1));
  const kept = flat.slice(start, end + 1);

  let distance = 0;
  for (let i = 1; i < kept.length; i++) {
    if (kept[i].segment === kept[i - 1].segment) {
      distance += getDistance(kept[i - 1].data, kept[i].data);
    }
  }

  // Per-segment kept span (max timestamp - min timestamp), summed across segments.
  const spans = new Map<number, { min: number; max: number }>();
  for (const p of kept) {
    const span = spans.get(p.segment);
    if (!span) {
      spans.set(p.segment, { min: p.timeStamp, max: p.timeStamp });
    } else {
      if (p.timeStamp < span.min) span.min = p.timeStamp;
      if (p.timeStamp > span.max) span.max = p.timeStamp;
    }
  }

  let duration = 0;
  for (const span of spans.values()) duration += span.max - span.min;

  return { coordinates: kept.map((p) => p.data), distance, duration };
}
