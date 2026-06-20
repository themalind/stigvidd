import { Facility, TrailMarkerResponse } from "@/data/types";

// GeoJSON builders that turn API DTOs / parsed positions into the render data
// MapLibre sources consume. These produce data in one direction (DTO → GeoJSON);
// they are not bidirectional conversion shims. GeoJSON.* types come from the
// global namespace declared by @types/geojson.

export function featureCollectionFromMarkers(
  markers: TrailMarkerResponse[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: markers
      .filter((m) => m.startLongitude != null && m.startLatitude != null)
      .map((m) => ({
        type: "Feature",
        id: m.identifier,
        properties: {
          identifier: m.identifier,
          name: m.name,
          isAccessible: m.isAccessible,
        },
        geometry: {
          type: "Point",
          coordinates: [m.startLongitude as number, m.startLatitude as number],
        },
      })),
  };
}

export function featureCollectionFromFacilities(facilities: Facility[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => ({
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
    })),
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
