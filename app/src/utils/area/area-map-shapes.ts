// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea, FacilityType, hasFacilityType } from "@/data/types";
import getBoundsFromTrail, { Bounds } from "@/utils/geo/get-bounds-from-trail";

export type MapFacilityKind = "swimming" | "shelter" | "firePit" | "other";

export interface AreaMapShapes {
  boundary: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;
  trails: GeoJSON.FeatureCollection<GeoJSON.LineString>;
  facilities: GeoJSON.FeatureCollection<GeoJSON.Point>;
  bounds: Bounds | null;
}

// keep-comment: one dot per facility, so a combined fire pit and shelter shows as a shelter
export function facilityKind(facilityType: number): MapFacilityKind {
  if (hasFacilityType(facilityType, FacilityType.SwimmingArea)) return "swimming";
  if (hasFacilityType(facilityType, FacilityType.Shelter)) return "shelter";
  if (hasFacilityType(facilityType, FacilityType.FirePit)) return "firePit";
  return "other";
}

export function areaMapShapes(area: CityArea): AreaMapShapes {
  const boundary = area.boundary ?? [];
  const paths = area.trails.flatMap((trail) => (trail.path && trail.path.length > 1 ? [trail.path] : []));
  const facilities = area.facilities.flatMap((facility) =>
    facility.longitude == null || facility.latitude == null
      ? []
      : [{ facility, position: [facility.longitude, facility.latitude] }],
  );

  return {
    boundary: {
      type: "FeatureCollection",
      features:
        boundary.length > 0
          ? [{ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: boundary } }]
          : [],
    },
    trails: {
      type: "FeatureCollection",
      features: paths.map((coordinates) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      })),
    },
    facilities: {
      type: "FeatureCollection",
      features: facilities.map(({ facility, position }) => ({
        type: "Feature",
        id: facility.identifier,
        properties: { kind: facilityKind(facility.facilityType) },
        geometry: { type: "Point", coordinates: position },
      })),
    },
    bounds: getBoundsFromTrail([
      ...boundary.flatMap((polygon) => polygon[0] ?? []),
      ...paths.flat(),
      ...facilities.map((f) => f.position),
    ]),
  };
}
