// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea, FacilityType } from "@/data/types";
import { AreaFilters, DEFAULT_AREA_FILTERS, areaFeatures, areaMunicipalities, groupAreas } from "../area-list";

const OTHER = "Övriga";

function area(name: string, overrides: Partial<CityArea> = {}): CityArea {
  return { identifier: name, name, location: "", facilities: [], trails: [], municipality: "Borås", ...overrides };
}

function facility(facilityType: number, isAccessible = false) {
  return { identifier: `f-${facilityType}`, name: "", facilityType, isAccessible };
}

const ALMENAS = area("Almenäs", { facilities: [facility(FacilityType.SwimmingArea | FacilityType.FirePit, true)] });
const RYA = area("Rya åsar", { facilities: [facility(FacilityType.Shelter)] });
const ASUNDEN = area("Åsunden", { municipality: "Ulricehamn", facilities: [facility(FacilityType.SwimmingArea)] });
const LOOSE = area("Okänd plats", { municipality: null });
// keep-comment: the API's order: nearest (or most popular) first
const AREAS = [RYA, ASUNDEN, ALMENAS, LOOSE];

function names(filters: Partial<AreaFilters>) {
  return groupAreas(AREAS, { ...DEFAULT_AREA_FILTERS, ...filters }, OTHER).map((group) => ({
    title: group.title,
    names: group.areas.map((a) => a.name),
  }));
}

describe("groupAreas", () => {
  it("keeps the API's order in one untitled group when sorted by nearest", () => {
    expect(names({})).toEqual([{ title: null, names: ["Rya åsar", "Åsunden", "Almenäs", "Okänd plats"] }]);
  });

  it("groups A–Ö by municipality, Swedish order, with areas without one last", () => {
    expect(names({ sort: "az" })).toEqual([
      { title: "Borås", names: ["Almenäs", "Rya åsar"] },
      { title: "Ulricehamn", names: ["Åsunden"] },
      { title: OTHER, names: ["Okänd plats"] },
    ]);
  });

  it("searches name and municipality without caring about accents or case", () => {
    expect(names({ search: "ALMENAS" })[0].names).toEqual(["Almenäs"]);
    expect(names({ search: "ulricehamn" })[0].names).toEqual(["Åsunden"]);
  });

  it("keeps only the chosen municipality", () => {
    expect(names({ municipality: "Ulricehamn" })[0].names).toEqual(["Åsunden"]);
  });

  it("keeps only areas that have every chosen feature", () => {
    expect(names({ features: ["swimming"] })[0].names).toEqual(["Åsunden", "Almenäs"]);
    expect(names({ features: ["swimming", "accessible"] })[0].names).toEqual(["Almenäs"]);
  });

  it("returns no groups when nothing matches", () => {
    expect(names({ search: "finns inte" })).toEqual([]);
    expect(names({ sort: "az", search: "finns inte" })).toEqual([]);
  });
});

describe("areaFeatures", () => {
  it("reads combined facility flags", () => {
    expect(areaFeatures(ALMENAS)).toEqual(["swimming", "firePit", "accessible"]);
    expect(areaFeatures(RYA)).toEqual(["shelter"]);
  });

  it("calls an area accessible when only one of its trails is", () => {
    const trail = { identifier: "t-1", name: "", trailLength: 1, classification: 1, averageRating: 0 };
    expect(areaFeatures(area("Kype", { trails: [{ ...trail, isAccessible: true }] }))).toEqual(["accessible"]);
    expect(areaFeatures(area("Kype", { trails: [trail] }))).toEqual([]);
  });
});

describe("areaMunicipalities", () => {
  it("lists each municipality once in Swedish order", () => {
    expect(areaMunicipalities([ASUNDEN, RYA, ALMENAS, LOOSE])).toEqual(["Borås", "Ulricehamn"]);
  });
});
