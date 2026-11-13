// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { type MapFilterItem } from "@/components/map/map-filter-menu";
import { MARKER_COLORS, SWIMMING_MARKER_COLORS } from "@/components/map/marker-styles";
import { FACILITY_ICONS } from "@/constants/facility-icons";
import { type AreaMapFocus, type AreaMapShapes, type MapFacilityKind } from "@/utils/area/area-map-shapes";

export type AreaMapFilter = {
  trails: boolean;
  swimming: boolean;
  firePits: boolean;
  shelters: boolean;
  accessibility: boolean;
};

export const AREA_FILTER_ITEMS: MapFilterItem<keyof AreaMapFilter>[] = [
  { key: "trails", label: "filter.trails", colors: MARKER_COLORS.trails },
  { key: "swimming", label: "filter.swimming", colors: SWIMMING_MARKER_COLORS },
  { key: "firePits", label: "filter.firePits", colors: MARKER_COLORS.firePits },
  { key: "shelters", label: "filter.shelters", colors: MARKER_COLORS.shelters },
  { key: "accessibility", label: "filter.accessibility", icon: FACILITY_ICONS.accessible },
];

export const SHOW_ALL_IN_AREA: AreaMapFilter = {
  trails: true,
  swimming: true,
  firePits: true,
  shelters: true,
  accessibility: false,
};

// keep-comment: which filter row hides each kind of facility dot
export const FILTER_KEY_OF_KIND = {
  swimming: "swimming",
  firePit: "firePits",
  shelter: "shelters",
} as const satisfies Record<Exclude<MapFacilityKind, "other">, keyof AreaMapFilter>;

// keep-comment: a row only for what this area has on the map; accessibility stays while on, or a focused link could not be undone
export function areaFilterItems(shapes: AreaMapShapes, filter: AreaMapFilter): MapFilterItem<keyof AreaMapFilter>[] {
  const features = [...shapes.trails.features, ...shapes.facilities.features];
  const keysOnMap = new Set(
    shapes.facilities.features.map(
      (f) => FILTER_KEY_OF_KIND[f.properties?.kind as keyof typeof FILTER_KEY_OF_KIND] as string | undefined,
    ),
  );
  return AREA_FILTER_ITEMS.filter(({ key }) => {
    if (key === "trails") return shapes.trails.features.length > 0;
    if (key === "accessibility") {
      return filter.accessibility || features.some((f) => f.properties?.isAccessible === true);
    }
    return keysOnMap.has(key);
  });
}

// keep-comment: a counted row's "show on the map" opens on only the accessible places; the camera frames that row's kind
export function initialAreaFilter(focus: AreaMapFocus | undefined): AreaMapFilter {
  return focus ? { ...SHOW_ALL_IN_AREA, accessibility: true } : SHOW_ALL_IN_AREA;
}
