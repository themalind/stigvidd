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
  // keep-comment: one start marker per trail, like the map tab; the paths only frame the camera
  trails: GeoJSON.FeatureCollection<GeoJSON.Point>;
  facilities: GeoJSON.FeatureCollection<GeoJSON.Point>;
  bounds: Bounds | null;
  // keep-comment: what a counted row's "show accessible on the map" frames; null when none of that kind is accessible
  accessibleBounds: Record<AreaMapFocus, Bounds | null>;
}

// keep-comment: the counted kinds, which have no usable names, so the map shows which of them are accessible
export type AreaMapFocus = "firePit" | "shelter";

export function isAreaMapFocus(value: string | undefined): value is AreaMapFocus {
  return value === "firePit" || value === "shelter";
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
  const trails = area.trails.flatMap((trail) =>
    trail.path && trail.path.length > 1
      ? [{ identifier: trail.identifier, path: trail.path, isAccessible: trail.isAccessible === true }]
      : [],
  );
  const paths = trails.map((trail) => trail.path);
  const facilities = area.facilities.flatMap((facility) =>
    facility.longitude == null || facility.latitude == null
      ? []
      : [{ facility, position: [facility.longitude, facility.latitude] }],
  );
  // keep-comment: fishing spots and nature reserves have no dot, so they never count as something on the map
  const drawn = facilities.filter(({ facility }) => facilityKind(facility.facilityType) !== "other");
  const accessibleOf = (type: (typeof FacilityType)[keyof typeof FacilityType]) =>
    atLeastSpan(
      getBoundsFromTrail(
        drawn
          .filter(({ facility }) => facility.isAccessible && hasFacilityType(facility.facilityType, type))
          .map((f) => f.position),
      ),
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
      features: trails.map(({ identifier, path, isAccessible }) => ({
        type: "Feature",
        id: identifier,
        properties: { identifier, isAccessible },
        geometry: { type: "Point", coordinates: path[0] },
      })),
    },
    facilities: {
      type: "FeatureCollection",
      features: drawn.map(({ facility, position }) => ({
        type: "Feature",
        id: facility.identifier,
        properties: {
          kind: facilityKind(facility.facilityType),
          // keep-comment: fire pits and shelters are counted, never named; their imported names are near-identical
          name: facilityKind(facility.facilityType) === "swimming" ? facility.name : "",
          isAccessible: facility.isAccessible,
        },
        geometry: { type: "Point", coordinates: position },
      })),
    },
    bounds: getBoundsFromTrail([
      ...boundary.flatMap((polygon) => polygon[0] ?? []),
      ...paths.flat(),
      ...drawn.map((f) => f.position),
    ]),
    accessibleBounds: {
      firePit: accessibleOf(FacilityType.FirePit),
      shelter: accessibleOf(FacilityType.Shelter),
    },
  };
}

// keep-comment: about 400 m, so a single accessible spot frames its surroundings instead of zooming to the maximum
const MIN_SPAN = 0.004;

function atLeastSpan(bounds: Bounds | null): Bounds | null {
  if (!bounds) return null;
  const [west, south, east, north] = bounds;
  const padLng = Math.max(0, (MIN_SPAN - (east - west)) / 2);
  const padLat = Math.max(0, (MIN_SPAN - (north - south)) / 2);
  return [west - padLng, south - padLat, east + padLng, north + padLat];
}
