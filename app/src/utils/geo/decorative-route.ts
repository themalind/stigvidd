// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { adjacentPairs } from "@/utils/adjacent-pairs";

// keep-comment: two waves of unrelated frequency read as wandering; one alone looks like a wave
const PRIMARY_WAVES = 2.1;
const SECONDARY_WAVES = 4.7;
const PRIMARY_PHASE = 0.4;
const SECONDARY_PHASE = 1.9;
const SECONDARY_WEIGHT = 0.35;

const SAMPLES = 64;

export interface DecorativeRoute {
  d: string;
  // keep-comment: exact, for the draw-on animation's strokeDashoffset
  length: number;
  start: [number, number];
  end: [number, number];
}

export function buildDecorativeRoute(width: number, height: number, padding = 16): DecorativeRoute {
  const innerWidth = Math.max(width - padding * 2, 0);
  // keep-comment: shared by both waves, so their sum still fits the box
  const amplitude = Math.max(height - padding * 2, 0) / 2 / (1 + SECONDARY_WEIGHT);
  const midY = height / 2;

  const pointAt = (t: number): [number, number] => [
    padding + t * innerWidth,
    midY +
      amplitude *
        (Math.sin(t * PRIMARY_WAVES * Math.PI + PRIMARY_PHASE) +
          SECONDARY_WEIGHT * Math.sin(t * SECONDARY_WAVES * Math.PI + SECONDARY_PHASE)),
  ];
  const points = Array.from({ length: SAMPLES }, (_, i) => pointAt(i / (SAMPLES - 1)));

  let length = 0;
  for (const [[x1, y1], [x2, y2]] of adjacentPairs(points)) {
    length += Math.hypot(x2 - x1, y2 - y1);
  }

  const d = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

  return { d, length, start: pointAt(0), end: pointAt(1) };
}
