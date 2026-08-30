// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The winding line on the get-started card and the stats heroes. Decoration, not data:
// the shape is generated. Sampled as a polyline so the draw-on animation gets the exact
// path length for strokeDashoffset by summing segments.

// Two sine waves of unrelated frequency read as wandering; one alone looks like a wave.
const PRIMARY_WAVES = 2.1;
const SECONDARY_WAVES = 4.7;
const PRIMARY_PHASE = 0.4;
const SECONDARY_PHASE = 1.9;
const SECONDARY_WEIGHT = 0.35;

const SAMPLES = 64;

export interface DecorativeRoute {
  d: string;
  /** Exact path length, for strokeDasharray / strokeDashoffset. */
  length: number;
  start: [number, number];
  end: [number, number];
}

export function buildDecorativeRoute(width: number, height: number, padding = 16): DecorativeRoute {
  const innerWidth = Math.max(width - padding * 2, 0);
  // Amplitude is shared between the two waves, so their sum still fits the box.
  const amplitude = Math.max(height - padding * 2, 0) / 2 / (1 + SECONDARY_WEIGHT);
  const midY = height / 2;

  const points: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const y =
      midY +
      amplitude *
        (Math.sin(t * PRIMARY_WAVES * Math.PI + PRIMARY_PHASE) +
          SECONDARY_WEIGHT * Math.sin(t * SECONDARY_WAVES * Math.PI + SECONDARY_PHASE));
    points.push([padding + t * innerWidth, y]);
  }

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }

  const d = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

  return { d, length, start: points[0], end: points[points.length - 1] };
}
