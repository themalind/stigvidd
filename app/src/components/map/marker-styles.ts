// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { AppDefaultTheme } from "@/constants/theme";
import { MapMarkerFilter } from "@/data/types";

// Marker categories that have their own coloured pin on the map. "accessibility"
// is a cross-cutting modifier (filters every category to accessible items), not a
// marker type of its own, so it is excluded here.
export type MarkerCategory = Exclude<keyof MapMarkerFilter, "accessibility">;

export interface MarkerColors {
  fill: string;
  stroke: string;
}

// The basemap never follows the app's dark mode (see map-style.ts), so
// markers always use the light palette: it reads best on that map and the light
// colours are simply nicer. These are theme-independent on purpose — a single
// source of truth shared by the map's CircleLayers and the filter menu legend so
// a category's pin always matches its filter swatch.
const colors = AppDefaultTheme.colors;

export const MARKER_COLORS: Record<MarkerCategory, MarkerColors> = {
  trails: { fill: colors.primary, stroke: colors.onPrimary },
  shelters: { fill: colors.tertiary, stroke: colors.onTertiary },
  firePits: { fill: colors.secondary, stroke: colors.onSecondary },
};

// The route line and the trailhead "start" marker sit on the same always-light
// basemap, so they must use the fixed light palette too — never useTheme(), which
// would turn them orange in the app's dark mode (the basemap stays light there).
export const ROUTE_LINE_COLOR = colors.primary;

// A white edge under every route line keeps the dark line visible on satellite imagery.
export function routeCasingPaint(lineWidth: number) {
  return { "line-color": colors.onPrimary, "line-width": lineWidth + 3 };
}

export const START_MARKER_COLORS: MarkerColors = {
  fill: colors.primary,
  stroke: colors.onPrimary,
};

// The selection ring drawn around the tapped cluster/trail while its carousel is
// open: a thin warm tertiary outline that hugs the marker and pops against the
// other (teal) trail pins and clusters. Same fixed light palette as every marker.
export const HIGHLIGHT_MARKER_COLORS = {
  ring: colors.tertiary,
};
