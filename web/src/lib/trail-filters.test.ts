// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { AdminTrailListItem } from "@/types/types";
import {
  emptyTrailFilters,
  filterTrails,
  filtersFromSearch,
  trailCities,
  type TrailFilterState,
} from "./trail-filters";

const NOW = Date.parse("2026-10-04T12:00:00Z");

function trail(overrides: Partial<AdminTrailListItem>): AdminTrailListItem {
  return {
    identifier: "id",
    name: "Name",
    trailLength: 5,
    accessibility: false,
    classification: 1,
    city: "Borås",
    isVerified: true,
    hasImages: true,
    hasExampleImages: false,
    hasSymbol: true,
    hasDescription: true,
    hasFullDescription: true,
    createdAt: "2026-01-01T00:00:00Z",
    lastUpdatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const trails = [
  trail({
    identifier: "a-1",
    name: "Björkehov blå",
    classification: 1,
    accessibility: true,
    trailLength: 2.5,
    hasImages: false,
    createdAt: "2026-03-01T00:00:00Z",
    lastUpdatedAt: "2026-10-04T08:00:00Z",
  }),
  trail({
    identifier: "b-2",
    name: "Storsjöleden",
    city: "Viskafors",
    classification: 3,
    isVerified: false,
    trailLength: 12,
    hasSymbol: false,
    hasFullDescription: false,
    createdAt: "2026-09-30T00:00:00Z",
    lastUpdatedAt: "2026-09-30T00:00:00Z",
  }),
  trail({
    identifier: "c-3",
    name: "Kransmossen gul",
    classification: 2,
    trailLength: 6,
    hasDescription: false,
    hasExampleImages: true,
    createdAt: "2025-05-01T00:00:00Z",
    lastUpdatedAt: "2026-08-01T00:00:00Z",
  }),
];

function names(filters: Partial<TrailFilterState>): string[] {
  return filterTrails(trails, { ...emptyTrailFilters, ...filters }, NOW).map((t) => t.name);
}

describe("filterTrails", () => {
  it("returns everything, sorted by name, with no filters", () => {
    expect(names({})).toEqual(["Björkehov blå", "Kransmossen gul", "Storsjöleden"]);
  });

  it("matches the name ignoring case and diacritics", () => {
    expect(names({ query: "STORSJOLEDEN" })).toEqual(["Storsjöleden"]);
  });

  it("matches the city and the identifier too", () => {
    expect(names({ query: "viskafors" })).toEqual(["Storsjöleden"]);
    expect(names({ query: "c-3" })).toEqual(["Kransmossen gul"]);
  });

  it("requires every word to match", () => {
    expect(names({ query: "boras gul" })).toEqual(["Kransmossen gul"]);
  });

  it("filters by status", () => {
    expect(names({ status: "Inactive" })).toEqual(["Storsjöleden"]);
    expect(names({ status: "Active" })).toEqual(["Björkehov blå", "Kransmossen gul"]);
  });

  it("filters by city, classification and accessibility", () => {
    expect(names({ city: "Viskafors" })).toEqual(["Storsjöleden"]);
    expect(names({ classification: "2" })).toEqual(["Kransmossen gul"]);
    expect(names({ accessibility: "Accessible" })).toEqual(["Björkehov blå"]);
    expect(names({ accessibility: "NotAccessible" })).toEqual(["Kransmossen gul", "Storsjöleden"]);
  });

  it("filters by what is missing", () => {
    expect(names({ missing: "Images" })).toEqual(["Björkehov blå"]);
    expect(names({ missing: "Symbol" })).toEqual(["Storsjöleden"]);
    expect(names({ missing: "Description" })).toEqual(["Kransmossen gul"]);
    expect(names({ missing: "FullDescription" })).toEqual(["Storsjöleden"]);
    expect(names({ missing: "ExampleImages" })).toEqual(["Kransmossen gul"]);
  });

  it("filters by how recently a trail was updated", () => {
    expect(names({ updatedWithinDays: "1" })).toEqual(["Björkehov blå"]);
    expect(names({ updatedWithinDays: "7" })).toEqual(["Björkehov blå", "Storsjöleden"]);
    expect(names({ updatedWithinDays: "30" })).toEqual(["Björkehov blå", "Storsjöleden"]);
  });

  it("filters by a length range, inclusive, accepting a decimal comma", () => {
    expect(names({ minKm: "2,5", maxKm: "6" })).toEqual(["Björkehov blå", "Kransmossen gul"]);
    expect(names({ minKm: "10" })).toEqual(["Storsjöleden"]);
    expect(names({ maxKm: "abc" })).toHaveLength(3);
  });

  it("sorts by newest, recently updated and length", () => {
    expect(names({ sort: "Newest" })).toEqual(["Storsjöleden", "Björkehov blå", "Kransmossen gul"]);
    expect(names({ sort: "RecentlyUpdated" })).toEqual(["Björkehov blå", "Storsjöleden", "Kransmossen gul"]);
    expect(names({ sort: "Shortest" })).toEqual(["Björkehov blå", "Kransmossen gul", "Storsjöleden"]);
    expect(names({ sort: "Longest" })).toEqual(["Storsjöleden", "Kransmossen gul", "Björkehov blå"]);
  });

  it("combines filters", () => {
    expect(names({ city: "Borås", classification: "1" })).toEqual(["Björkehov blå"]);
  });
});

describe("trailCities", () => {
  it("lists each non-empty city once, sorted", () => {
    expect(trailCities([...trails, trail({ city: "" }), trail({ city: "Alingsås" })])).toEqual([
      "Alingsås",
      "Borås",
      "Viskafors",
    ]);
  });
});

describe("filtersFromSearch", () => {
  it("presets the status, missing and sort filters from the URL", () => {
    const filters = filtersFromSearch(new URLSearchParams("status=Inactive&missing=ExampleImages&sort=Newest"));

    expect(filters).toEqual({ ...emptyTrailFilters, status: "Inactive", missing: "ExampleImages", sort: "Newest" });
  });

  it("ignores values it does not know", () => {
    expect(filtersFromSearch(new URLSearchParams("status=Deleted&missing=x"))).toEqual(emptyTrailFilters);
  });
});
