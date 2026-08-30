// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { buildRouteThumbnail } from "@/utils/route-thumbnail";

function pointsFrom(d: string): [number, number][] {
  return d
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((segment) => {
      const [x, y] = segment.slice(1).trim().split(" ").map(Number);
      return [x, y] as [number, number];
    });
}

// [longitude, latitude], the order CoordinateParser emits.
const SQUARE: GeoJSON.Position[] = [
  [13.0, 57.0],
  [13.1, 57.0],
  [13.1, 57.1],
  [13.0, 57.1],
];

describe("buildRouteThumbnail", () => {
  it("fits the track inside the padded box", () => {
    const { d } = buildRouteThumbnail(SQUARE, 52, 52, 6)!;

    for (const [x, y] of pointsFrom(d)) {
      expect(x).toBeGreaterThanOrEqual(6);
      expect(x).toBeLessThanOrEqual(46);
      expect(y).toBeGreaterThanOrEqual(6);
      expect(y).toBeLessThanOrEqual(46);
    }
  });

  it("touches the padding on the axis it fills, and centres on the other", () => {
    // Latitude spans further than longitude does once the cos correction is applied, so
    // the vertical axis is the one that fills.
    const { d } = buildRouteThumbnail(SQUARE, 52, 52, 6)!;
    const points = pointsFrom(d);
    const ys = points.map(([, y]) => y);
    const xs = points.map(([x]) => x);

    expect(Math.min(...ys)).toBeCloseTo(6);
    expect(Math.max(...ys)).toBeCloseTo(46);
    // Centred: the leftover width is split evenly.
    expect(Math.min(...xs) - 0).toBeCloseTo(52 - Math.max(...xs));
  });

  it("does not stretch a due-north track across the box", () => {
    const northward: GeoJSON.Position[] = [
      [13.0, 57.0],
      [13.0, 57.05],
      [13.0, 57.1],
    ];
    const { d } = buildRouteThumbnail(northward, 52, 52)!;
    const xs = pointsFrom(d).map(([x]) => x);

    // No horizontal extent at all, parked on the centre line.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0);
    expect(xs[0]).toBeCloseTo(26);
  });

  it("corrects for longitude convergence rather than filling both axes", () => {
    // Equal degree spans: at 57°N the longitude span is the shorter one on the ground,
    // so it must render shorter than the latitude span.
    const { d } = buildRouteThumbnail(SQUARE, 52, 52, 6)!;
    const points = pointsFrom(d);
    const drawnWidth = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
    const drawnHeight = Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y));

    expect(drawnWidth / drawnHeight).toBeCloseTo(Math.cos((57.05 * Math.PI) / 180), 2);
  });

  it("puts north at the top", () => {
    const { d } = buildRouteThumbnail(SQUARE, 52, 52)!;
    const points = pointsFrom(d);

    // SQUARE starts at the southern edge and its third point is the northern one.
    expect(points[0][1]).toBeGreaterThan(points[2][1]);
  });

  it("reports endpoints that match the path", () => {
    const { d, start, end } = buildRouteThumbnail(SQUARE, 52, 52)!;
    const points = pointsFrom(d);

    expect(start[0]).toBeCloseTo(points[0][0], 1);
    expect(start[1]).toBeCloseTo(points[0][1], 1);
    expect(end[0]).toBeCloseTo(points[points.length - 1][0], 1);
    expect(end[1]).toBeCloseTo(points[points.length - 1][1], 1);
  });

  it("caps the point count and keeps the final position", () => {
    const long: GeoJSON.Position[] = Array.from({ length: 5000 }, (_, i) => [13 + i * 0.0001, 57 + i * 0.0002]);
    const { d, end } = buildRouteThumbnail(long, 52, 52, 6)!;
    const points = pointsFrom(d);

    expect(points.length).toBeLessThanOrEqual(120);
    expect(end[0]).toBeCloseTo(points[points.length - 1][0], 1);
    // The last sample is the track's own last point: the far corner of the box.
    expect(points[points.length - 1][1]).toBeCloseTo(6);
  });

  it("returns null for a track with nothing to draw", () => {
    expect(buildRouteThumbnail([], 52, 52)).toBeNull();
    expect(buildRouteThumbnail([[13, 57]], 52, 52)).toBeNull();
    expect(
      buildRouteThumbnail(
        [
          [13, 57],
          [13, 57],
        ],
        52,
        52,
      ),
    ).toBeNull();
  });

  it("produces no NaN when the padding swallows the box", () => {
    const { d } = buildRouteThumbnail(SQUARE, 12, 12, 8)!;

    expect(pointsFrom(d).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
