// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: each stack that shows an area has its own copy, so a tap stays in that tab's history
export const HOME_AREA_ROUTES = {
  detail: "/(tabs)/(home)/area/[identifier]",
  map: "/(tabs)/(home)/area/map/[identifier]",
  trail: "/(tabs)/(home)/trail/[identifier]",
  trailFollow: "/(tabs)/(home)/follow/[identifier]",
} as const;

export const TRAILS_TAB_AREA_ROUTES = {
  detail: "/(tabs)/trails/area/[identifier]",
  map: "/(tabs)/trails/area/map/[identifier]",
  trail: "/(tabs)/trails/trail/[identifier]",
  trailFollow: "/(tabs)/trails/follow/[identifier]",
} as const;

export type AreaStackRoutes = typeof HOME_AREA_ROUTES | typeof TRAILS_TAB_AREA_ROUTES;
