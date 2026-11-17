// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Bounds } from "@/utils/geo/get-bounds-from-trail";
import type { InitialViewState, ViewPadding } from "@maplibre/maplibre-react-native";

export const SINGLE_POINT_ZOOM = 15;

// The first frame a map draws, so it opens on its content instead of the whole world. keep-comment: why maps start here, not only in onDidFinishLoadingMap
export function initialViewFor(bounds: Bounds | null | undefined, padding: ViewPadding): InitialViewState | undefined {
  if (!bounds) return undefined;
  const [west, south, east, north] = bounds;
  if (west === east && south === north) return { center: [west, south], zoom: SINGLE_POINT_ZOOM };
  return { bounds, padding };
}
