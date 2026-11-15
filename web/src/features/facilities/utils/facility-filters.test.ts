// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { AdminFacilityResponse } from "@/api/generated/model";
import {
  facilitySearchDefaults,
  facilitySources,
  filterFacilities,
  filtersFromSearch,
  HAND_ENTERED,
  type FacilityFilterState,
} from "./facility-filters";

function facility(overrides: Partial<AdminFacilityResponse>): AdminFacilityResponse {
  return {
    identifier: "id",
    name: "Name",
    facilityType: 8,
    isAccessible: false,
    latitude: 57.7,
    longitude: 12.9,
    location: "",
    description: "",
    url: "",
    sourceId: null,
    sourceKey: null,
    nameKey: "name",
    areaNames: [],
    lastUpdatedAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

const all: FacilityFilterState = { query: "", ...filtersFromSearch(facilitySearchDefaults) };

const handTyped = facility({
  identifier: "hand",
  name: "Dalsjöns badplats",
  nameKey: "dalsjön",
  latitude: null,
  longitude: null,
  areaNames: ["Dalsjöfors"],
});
const imported = facility({
  identifier: "imported",
  name: "Dalsjön badplats",
  nameKey: "dalsjön",
  sourceId: "boras:badplatser:1490-6474",
  sourceKey: "boras:badplatser",
});
const firepit = facility({
  identifier: "firepit",
  name: "Rya åsar grillplats",
  nameKey: "rya åsar",
  facilityType: 1,
  sourceId: "boras:grill:7",
  sourceKey: "boras:grill",
});

const names = (list: AdminFacilityResponse[]) => list.map((f) => f.identifier);

describe("filterFacilities", () => {
  const facilities = [firepit, imported, handTyped];

  it("shows only facilities whose name looks like another's when asked for duplicates", () => {
    expect(names(filterFacilities(facilities, { ...all, duplicates: "Likely" }))).toEqual(["imported", "hand"]);
  });

  it("never pairs facilities whose name key is empty", () => {
    const blank = [facility({ identifier: "a", nameKey: "" }), facility({ identifier: "b", nameKey: "" })];

    expect(filterFacilities(blank, { ...all, duplicates: "Likely" })).toEqual([]);
  });

  it("separates hand-entered facilities from each data source", () => {
    expect(names(filterFacilities(facilities, { ...all, source: HAND_ENTERED }))).toEqual(["hand"]);
    expect(names(filterFacilities(facilities, { ...all, source: "boras:badplatser" }))).toEqual(["imported"]);
  });

  it("finds facilities without a position or an area", () => {
    expect(names(filterFacilities(facilities, { ...all, position: "Missing" }))).toEqual(["hand"]);
    expect(names(filterFacilities(facilities, { ...all, area: "None" }))).toEqual(["imported", "firepit"]);
  });

  it("filters on any one type bit", () => {
    expect(names(filterFacilities(facilities, { ...all, type: "1" }))).toEqual(["firepit"]);
  });

  it("searches the area names too", () => {
    expect(names(filterFacilities(facilities, { ...all, query: "dalsjofors" }))).toEqual(["hand"]);
  });
});

describe("filtersFromSearch", () => {
  it("keeps a known type and falls back to all types for anything else in the URL", () => {
    expect(filtersFromSearch({ type: "1" }).type).toBe("1");
    expect(filtersFromSearch({ type: "abc" }).type).toBe("All");
  });
});

describe("facilitySources", () => {
  it("lists each data source once, without hand-entered facilities", () => {
    const sameSource = facility({ identifier: "other", sourceKey: "boras:badplatser" });

    expect(facilitySources([firepit, imported, sameSource, handTyped])).toEqual(["boras:badplatser", "boras:grill"]);
  });
});
