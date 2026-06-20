import { Facility, TrailMarkerResponse } from "@/data/types";
import { featureCollectionFromFacilities, featureCollectionFromMarkers, lineStringFromPositions } from "../geojson";

describe("featureCollectionFromMarkers", () => {
  it("maps markers to point features in [lng, lat] order with carried properties", () => {
    const markers: TrailMarkerResponse[] = [
      { identifier: "t1", name: "Trail 1", isAccessible: true, startLatitude: 57.7, startLongitude: 12.0 },
    ];

    const fc = featureCollectionFromMarkers(markers);

    expect(fc).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "t1",
          properties: { identifier: "t1", name: "Trail 1", isAccessible: true },
          geometry: { type: "Point", coordinates: [12.0, 57.7] },
        },
      ],
    });
  });

  it("skips markers missing a start coordinate", () => {
    const markers: TrailMarkerResponse[] = [
      { identifier: "t1", name: "Has coords", isAccessible: false, startLatitude: 57.7, startLongitude: 12.0 },
      { identifier: "t2", name: "No longitude", isAccessible: false, startLatitude: 57.7 },
      { identifier: "t3", name: "No latitude", isAccessible: false, startLongitude: 12.0 },
      { identifier: "t4", name: "No coords", isAccessible: false },
    ];

    const fc = featureCollectionFromMarkers(markers);

    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].id).toBe("t1");
  });

  it("keeps a zero coordinate (falsy but valid)", () => {
    const markers: TrailMarkerResponse[] = [
      { identifier: "t0", name: "Null Island", isAccessible: false, startLatitude: 0, startLongitude: 0 },
    ];

    const fc = featureCollectionFromMarkers(markers);

    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates).toEqual([0, 0]);
  });

  it("returns an empty feature collection for no markers", () => {
    expect(featureCollectionFromMarkers([])).toEqual({ type: "FeatureCollection", features: [] });
  });
});

describe("featureCollectionFromFacilities", () => {
  it("maps facilities to point features in [lng, lat] order", () => {
    const facilities: Facility[] = [
      { identifier: "f1", name: "Shelter", facilityType: 2, isAccessible: true, latitude: 58.0, longitude: 13.0 },
    ];

    const fc = featureCollectionFromFacilities(facilities);

    expect(fc.features).toEqual([
      {
        type: "Feature",
        id: "f1",
        properties: { identifier: "f1", name: "Shelter", isAccessible: true },
        geometry: { type: "Point", coordinates: [13.0, 58.0] },
      },
    ]);
  });
});

describe("lineStringFromPositions", () => {
  it("wraps positions in a LineString feature", () => {
    const positions: GeoJSON.Position[] = [
      [12.0, 57.7],
      [12.1, 57.8],
    ];

    expect(lineStringFromPositions(positions)).toEqual({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: positions },
    });
  });

  it("handles an empty path", () => {
    expect(lineStringFromPositions([])).toEqual({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [] },
    });
  });
});
