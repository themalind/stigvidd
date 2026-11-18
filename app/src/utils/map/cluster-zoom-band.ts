// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface ClusterZoomBand {
  min: number;
  max: number;
}

// keep-comment: MapLibre has no merge zoom, so the bottom mirrors the split distance; uncapped,
// keep-comment: a co-located cluster (split far above) would never close on zoom-out
export const MERGE_ZOOM_OUT_CAP = 0.3;

// keep-comment: the zooms where an open selection still matches the map: above it splits, below it merges
export function clusterZoomBand(
  z0: number | null | undefined,
  expansionZoom: number | null | undefined,
  cap: number = MERGE_ZOOM_OUT_CAP,
): ClusterZoomBand | null {
  if (z0 == null) return null;

  if (expansionZoom != null && expansionZoom > z0) {
    const mergeDistance = Math.min(expansionZoom - z0, cap);
    return { min: z0 - mergeDistance, max: expansionZoom };
  }

  // keep-comment: a single trail never splits, but still merges into a cluster on zoom-out
  return { min: z0 - cap, max: Infinity };
}

export function isZoomOutsideBand(zoom: number, band: ClusterZoomBand | null): boolean {
  return band != null && (zoom >= band.max || zoom <= band.min);
}
