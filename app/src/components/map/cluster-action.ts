// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export type ClusterAction = { readonly kind: "zoom"; readonly zoom: number } | { readonly kind: "carousel" };

export interface ClusterActionConfig {
  // keep-comment: past this zoom a cluster is co-located, since zooming would not split it
  readonly clusterMaxZoom: number;
  // keep-comment: small clusters are usually trails sharing a trailhead, so they open cards
  readonly carouselMaxCount: number;
}

// keep-comment: no expansionZoom from MapLibre falls back to the cards
export function decideClusterAction(
  pointCount: number,
  expansionZoom: number | null | undefined,
  config: ClusterActionConfig,
): ClusterAction {
  if (expansionZoom != null && expansionZoom <= config.clusterMaxZoom && pointCount > config.carouselMaxCount) {
    return { kind: "zoom", zoom: expansionZoom };
  }

  return { kind: "carousel" };
}
