// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  CONTRIBUTION_MARKER_COLORS,
  MARKER_COLORS,
  MarkerColors,
  START_MARKER_COLORS,
  SWIMMING_MARKER_COLORS,
} from "@/components/map/marker-styles";

function hslToRgb(h: number, s: number, l: number): number[] {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

function toRgb(color: string): number[] {
  const numbers = (color.match(/[\d.]+/g) ?? []).map(Number);
  if (color.startsWith("#")) return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  if (color.startsWith("rgb")) return numbers.slice(0, 3);
  if (color.startsWith("hsl")) return hslToRgb(numbers[0] ?? 0, (numbers[1] ?? 0) / 100, (numbers[2] ?? 0) / 100);
  throw new Error(`unsupported colour ${color}`);
}

function luminance(color: string): number {
  const [r = 0, g = 0, b = 0] = toRgb(color).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const PINS: [string, MarkerColors][] = [
  ...Object.entries(MARKER_COLORS),
  ["contributions", CONTRIBUTION_MARKER_COLORS],
  ["swimming", SWIMMING_MARKER_COLORS],
  ["start", START_MARKER_COLORS],
];

it("measures contrast as WCAG does", () => {
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
  expect(contrast("hsl(0, 0%, 100%)", "rgb(0, 0, 0)")).toBeCloseTo(21);
});

// A cluster writes its count in the stroke colour on the fill, at 12 px, so WCAG's 4.5:1 for small text applies. keep-comment: why 4.5 and not 3
it.each(PINS)("keeps the %s cluster count readable", (_, colors) => {
  expect(contrast(colors.fill, colors.stroke)).toBeGreaterThanOrEqual(4.5);
});
