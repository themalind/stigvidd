// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea, FacilityType } from "@/data/types";
import { areaMapShapes, facilityKind } from "../area-map-shapes";

const SQUARE = [
  [
    [
      [12.9, 57.7],
      [13.0, 57.7],
      [13.0, 57.8],
      [12.9, 57.7],
    ],
  ],
];

function area(overrides: Partial<CityArea>): CityArea {
  return { identifier: "a", name: "A", location: "", facilities: [], trails: [], ...overrides };
}

describe("areaMapShapes", () => {
  it("draws the boundary, the trails with a path and the facilities with a position", () => {
    const shapes = areaMapShapes(
      area({
        boundary: SQUARE,
        trails: [
          {
            identifier: "t",
            name: "",
            trailLength: 1,
            classification: 1,
            averageRating: 0,
            path: [
              [12.95, 57.75],
              [13.1, 57.76],
            ],
          },
          { identifier: "u", name: "", trailLength: 1, classification: 1, averageRating: 0, path: null },
        ],
        facilities: [
          {
            identifier: "bad",
            name: "",
            facilityType: FacilityType.SwimmingArea,
            isAccessible: false,
            latitude: 57.71,
            longitude: 12.91,
          },
          { identifier: "x", name: "", facilityType: FacilityType.FirePit, isAccessible: false },
        ],
      }),
    );

    expect(shapes.boundary.features).toHaveLength(1);
    expect(shapes.trails.features).toHaveLength(1);
    expect(shapes.facilities.features.map((f) => [f.id, f.properties?.kind])).toEqual([["bad", "swimming"]]);
    expect(shapes.bounds).toEqual([12.9, 57.7, 13.1, 57.8]);
  });

  it("has no bounds when there is nothing to draw", () => {
    const shapes = areaMapShapes(area({ boundary: null }));

    expect(shapes.boundary.features).toEqual([]);
    expect(shapes.bounds).toBeNull();
  });
});

describe("facilityKind", () => {
  it("prefers swimming, then shelter, then fire pit", () => {
    expect(facilityKind(FacilityType.SwimmingArea | FacilityType.FirePit)).toBe("swimming");
    expect(facilityKind(FacilityType.FirePit | FacilityType.Shelter)).toBe("shelter");
    expect(facilityKind(FacilityType.FirePit)).toBe("firePit");
    expect(facilityKind(FacilityType.FishingArea)).toBe("other");
  });
});
