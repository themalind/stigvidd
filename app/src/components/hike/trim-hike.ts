// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { LatLng, Segment } from "@/data/types";
import { adjacentPairs } from "@/utils/adjacent-pairs";
import { getDistance } from "geolib";

export type TrimmedHike = {
  coordinates: LatLng[];
  distance: number; // meters
  duration: number; // milliseconds
};

type FlatPoint = { data: LatLng; timeStamp: number; segment: number };

// keep-comment: the segment tag stops a pause gap from counting as travel
export function flattenSegments(segments: Segment[]): FlatPoint[] {
  const flat: FlatPoint[] = [];
  segments.forEach((seg, segment) => {
    seg.coordinates.forEach((c) => flat.push({ data: c.data, timeStamp: c.timeStamp, segment }));
  });
  return flat;
}

// keep-comment: distance and duration are summed per segment, so paused time and gaps never count
export function recomputeTrimmedHike(segments: Segment[], startIndex: number, endIndex: number): TrimmedHike {
  const flat = flattenSegments(segments);
  if (flat.length === 0) return { coordinates: [], distance: 0, duration: 0 };

  const start = Math.max(0, Math.min(startIndex, flat.length - 1));
  const end = Math.max(start, Math.min(endIndex, flat.length - 1));
  const kept = flat.slice(start, end + 1);

  let distance = 0;
  for (const [previous, point] of adjacentPairs(kept)) {
    if (point.segment === previous.segment) {
      distance += getDistance(previous.data, point.data);
    }
  }

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

  // keep-comment: iOS timestamps carry fractional ms and the API's int Duration answers 400
  return { coordinates: kept.map((p) => p.data), distance, duration: Math.round(duration) };
}
