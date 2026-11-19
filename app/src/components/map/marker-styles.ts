// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AppDefaultTheme } from "@/constants/theme";
import { MapMarkerFilter } from "@/data/types";

// keep-comment: accessibility filters every category and has no pin of its own
export type MarkerCategory = Exclude<keyof MapMarkerFilter, "accessibility">;

export interface MarkerColors {
  fill: string;
  stroke: string;
}

// keep-comment: always the light palette, since the basemap stays light in dark mode; shared with the filter legend
const colors = AppDefaultTheme.colors;

// keep-comment: trails published from users' walks share the trails source, told apart by this pin colour and their own filter row
export const CONTRIBUTION_MARKER_COLORS: MarkerColors = {
  fill: "#7B2D82",
  stroke: colors.onPrimary,
};

export const MARKER_COLORS: Record<MarkerCategory, MarkerColors> = {
  trails: { fill: colors.primary, stroke: colors.onPrimary },
  contributions: CONTRIBUTION_MARKER_COLORS,
  // keep-comment: a shade under the theme's tertiary, which is too light for the white cluster count
  shelters: { fill: "#BC5624", stroke: colors.onTertiary },
  firePits: { fill: colors.secondary, stroke: colors.onSecondary },
};

// keep-comment: swimming is a third dot colour beside fire pits and shelters, a water turquoise kept apart from the trails' dark blue
export const SWIMMING_MARKER_COLORS: MarkerColors = {
  fill: "#00838F",
  stroke: colors.onPrimary,
};

export const ROUTE_LINE_COLOR = colors.primary;

// keep-comment: the white edge keeps the dark line visible on satellite imagery
export function routeCasingPaint(lineWidth: number) {
  return { "line-color": colors.onPrimary, "line-width": lineWidth + 3 };
}

export const START_MARKER_COLORS: MarkerColors = {
  fill: colors.primary,
  stroke: colors.onPrimary,
};

export const HIGHLIGHT_MARKER_COLORS = {
  ring: colors.tertiary,
};
