import { Facility, TrailMarkerResponse } from "@/data/types";

// GeoJSON builders that turn API DTOs / parsed positions into the render data
// MapLibre sources consume. These produce data in one direction (DTO → GeoJSON);
// they are not bidirectional conversion shims. GeoJSON.* types come from the
// global namespace declared by @types/geojson.

export function featureCollectionFromMarkers(
  markers: TrailMarkerResponse[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  // Single pass: skip markers without a start coordinate while building, so we
  // never emit a feature with undefined coordinates.
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
  const features: GeoJSON.Feature<GeoJSON.Point>[] = facilities.map((f) => ({
    type: "Feature",
    id: f.identifier,
    properties: {
      identifier: f.identifier,
      name: f.name,
      isAccessible: f.isAccessible,
    },
    geometry: {
      type: "Point",
      coordinates: [f.longitude, f.latitude],
    },
  }));

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
