// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Facility, TrailMarkerResponse, TrailObstacle } from "@/data/types";

// keep-comment: GeoJSON types a position as number[], though the spec requires a longitude and a latitude
export function lngLat(position: GeoJSON.Position): [lng: number, lat: number] {
  const [lng, lat] = position;
  if (lng === undefined || lat === undefined) throw new Error("A position needs a longitude and a latitude");
  return [lng, lat];
}

export function featureCollectionFromMarkers(markers: TrailMarkerResponse[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const m of markers) {
    if (m.startLongitude == null || m.startLatitude == null) continue;
    features.push({
      type: "Feature",
      id: m.identifier,
      properties: {
        identifier: m.identifier,
        name: m.name,
        isAccessible: m.isAccessible,
        isContribution: m.isContribution ?? false,
      },
      geometry: {
        type: "Point",
        coordinates: [m.startLongitude, m.startLatitude],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function featureCollectionFromFacilities(facilities: Facility[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const f of facilities) {
    if (f.longitude == null || f.latitude == null) continue;
    features.push({
      type: "Feature",
      id: f.identifier,
      properties: {
        identifier: f.identifier,
        name: f.name,
        isAccessible: f.isAccessible,
        facilityType: f.facilityType,
      },
      geometry: {
        type: "Point",
        coordinates: [f.longitude, f.latitude],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function featureCollectionFromObstacles(obstacles: TrailObstacle[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const o of obstacles) {
    if (o.incidentLongitude == null || o.incidentLatitude == null) continue;
    features.push({
      type: "Feature",
      id: o.identifier,
      properties: {
        identifier: o.identifier,
        issueType: o.issueType,
      },
      geometry: {
        type: "Point",
        coordinates: [o.incidentLongitude, o.incidentLatitude],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function pointFeatureFromPosition(position: GeoJSON.Position): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: position,
    },
  };
}

export function lineStringFromPositions(positions: GeoJSON.Position[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: positions,
    },
  };
}
