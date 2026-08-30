// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { LatLng } from "@/data/types";
import { FilterableTrail, useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { act, renderHook } from "@testing-library/react-native";

// Borås, and a handful of trails at increasing distances from it. Real coordinates
// so geolib runs for real — the distance maths is not what these tests are pinning down,
// only the ordering and the radius cut-off it produces.
const BORAS: LatLng = { latitude: 57.721, longitude: 12.9401 };

function makeTrail(overrides: Partial<FilterableTrail> & { identifier: string }): FilterableTrail {
  return {
    name: `Trail ${overrides.identifier}`,
    trailLength: 5,
    accessibility: false,
    classification: 1,
    city: "Borås",
    startLatitude: 57.721,
    startLongitude: 12.9401,
    ...overrides,
  };
}

// A deliberately mixed set: three cities, three difficulties, lengths 2/8/20,
// one accessible, and start points spread out from Borås.
const TRAILS: FilterableTrail[] = [
  makeTrail({
    identifier: "a",
    name: "Ängsstigen",
    city: "Borås",
    trailLength: 2,
    classification: 1,
    accessibility: true,
    startLatitude: 57.73,
    startLongitude: 12.95,
  }),
  makeTrail({
    identifier: "b",
    name: "Bokskogen",
    city: "Rångedala",
    trailLength: 20,
    classification: 3,
    startLatitude: 57.85,
    startLongitude: 13.15,
  }),
  makeTrail({
    identifier: "c",
    name: "Älvpromenaden",
    city: "Borås",
    trailLength: 8,
    classification: 2,
    startLatitude: 57.76,
    startLongitude: 12.99,
  }),
];

const names = (trails: { name: string }[]) => trails.map((trail) => trail.name);

describe("useTrailFilters", () => {
  describe("defaults", () => {
    it("sorts by name ascending before the user touches anything", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      expect(result.current.sortBy).toBe("name-asc");
      expect(names(result.current.filteredTrails)).toEqual(["Bokskogen", "Älvpromenaden", "Ängsstigen"]);
    });

    it("returns an empty list rather than throwing when trails are undefined", () => {
      const { result } = renderHook(() => useTrailFilters(undefined, null));

      expect(result.current.filteredTrails).toEqual([]);
      expect(result.current.cities).toEqual([]);
      expect(result.current.classifications).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.filteredCount).toBe(0);
    });

    it("reports counts before and after filtering", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("city", "Borås"));

      expect(result.current.totalCount).toBe(3);
      expect(result.current.filteredCount).toBe(2);
    });
  });

  describe("option lists", () => {
    it("lists unique city names in alphabetical order", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      expect(result.current.cities).toEqual(["Borås", "Rångedala"]);
    });

    it("lists unique classifications and drops the unclassified zero", () => {
      const withUnclassified = [...TRAILS, makeTrail({ identifier: "d", classification: 0 })];
      const { result } = renderHook(() => useTrailFilters(withUnclassified, null));

      expect(result.current.classifications).toEqual([1, 2, 3]);
    });
  });

  describe("search", () => {
    it("matches on name, case-insensitively", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSearchQuery("BOKSKOG"));

      expect(names(result.current.filteredTrails)).toEqual(["Bokskogen"]);
    });

    it("matches on city as well as name", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSearchQuery("rångedala"));

      expect(names(result.current.filteredTrails)).toEqual(["Bokskogen"]);
    });

    it("ignores surrounding whitespace", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSearchQuery("   bok   "));

      expect(names(result.current.filteredTrails)).toEqual(["Bokskogen"]);
    });

    it("treats a whitespace-only query as no query at all", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSearchQuery("   "));

      expect(result.current.filteredTrails).toHaveLength(3);
    });

    it("returns nothing when the query matches no trail", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSearchQuery("finns inte"));

      expect(result.current.filteredTrails).toEqual([]);
    });
  });

  describe("filters", () => {
    it("filters by city", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("city", "Borås"));

      expect(names(result.current.filteredTrails)).toEqual(["Älvpromenaden", "Ängsstigen"]);
    });

    it("filters by classification", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("classification", 3));

      expect(names(result.current.filteredTrails)).toEqual(["Bokskogen"]);
    });

    it("keeps only accessible trails when accessibility is on", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("accessibility", true));

      expect(names(result.current.filteredTrails)).toEqual(["Ängsstigen"]);
    });

    it("applies a length range inclusively at both ends", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateLengthFilter(2, 8));

      // 2 and 8 are the boundary values and both survive; 20 does not.
      expect(result.current.filteredTrails.map((trail) => trail.trailLength)).toEqual([2, 8]);
    });

    it("combines several filters", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("city", "Borås"));
      act(() => result.current.updateFilter("classification", 2));

      expect(names(result.current.filteredTrails)).toEqual(["Älvpromenaden"]);
    });

    it("clears filters, search and sort order back to the defaults", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("city", "Borås"));
      act(() => result.current.setSearchQuery("äng"));
      act(() => result.current.setSortBy("length-desc"));

      act(() => result.current.clearFilters());

      expect(result.current.filters).toEqual({});
      expect(result.current.searchQuery).toBe("");
      expect(result.current.sortBy).toBe("name-asc");
      expect(result.current.filteredTrails).toHaveLength(3);
    });
  });

  describe("distance", () => {
    it("leaves distanceKm undefined when the user's location is unknown", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      expect(result.current.filteredTrails.every((trail) => trail.distanceKm === undefined)).toBe(true);
    });

    it("leaves distanceKm undefined for a trail without start coordinates", () => {
      const noCoords = [makeTrail({ identifier: "x", startLatitude: undefined, startLongitude: undefined })];
      const { result } = renderHook(() => useTrailFilters(noCoords, BORAS));

      expect(result.current.filteredTrails[0].distanceKm).toBeUndefined();
    });

    it("ignores the near-me filter when the user's location is unknown", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.updateFilter("nearMe", true));

      expect(result.current.filteredTrails).toHaveLength(3);
    });

    it("keeps only trails inside the radius when near-me is on", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, BORAS));

      act(() => result.current.updateFilter("nearMe", true));
      act(() => result.current.updateFilter("maxDistance", 10));

      // Bokskogen sits roughly 20 km out and drops away; the two Borås trails are within 10 km.
      expect(names(result.current.filteredTrails)).toEqual(["Ängsstigen", "Älvpromenaden"]);
    });

    it("switches to distance sorting as soon as near-me is turned on", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, BORAS));

      act(() => result.current.updateFilter("nearMe", true));

      expect(result.current.sortBy).toBe("distance-asc");
    });
  });

  describe("sorting", () => {
    it("sorts by name descending", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSortBy("name-desc"));

      expect(names(result.current.filteredTrails)).toEqual(["Ängsstigen", "Älvpromenaden", "Bokskogen"]);
    });

    it("orders å, ä and ö last, as Swedish collation requires", () => {
      const trails = [
        makeTrail({ identifier: "1", name: "Östervik" }),
        makeTrail({ identifier: "2", name: "Zebrastigen" }),
        makeTrail({ identifier: "3", name: "Åsstigen" }),
      ];
      const { result } = renderHook(() => useTrailFilters(trails, null));

      expect(names(result.current.filteredTrails)).toEqual(["Zebrastigen", "Åsstigen", "Östervik"]);
    });

    it("sorts by length in both directions", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSortBy("length-asc"));
      expect(result.current.filteredTrails.map((trail) => trail.trailLength)).toEqual([2, 8, 20]);

      act(() => result.current.setSortBy("length-desc"));
      expect(result.current.filteredTrails.map((trail) => trail.trailLength)).toEqual([20, 8, 2]);
    });

    it("sorts by distance nearest first", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, BORAS));

      act(() => result.current.setSortBy("distance-asc"));

      expect(names(result.current.filteredTrails)).toEqual(["Ängsstigen", "Älvpromenaden", "Bokskogen"]);
    });

    it("sorts by distance furthest first", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, BORAS));

      act(() => result.current.setSortBy("distance-desc"));

      expect(names(result.current.filteredTrails)).toEqual(["Bokskogen", "Älvpromenaden", "Ängsstigen"]);
    });

    it("puts trails without a distance last when sorting nearest first", () => {
      const trails = [
        makeTrail({ identifier: "far", name: "Utan position", startLatitude: undefined, startLongitude: undefined }),
        makeTrail({ identifier: "near", name: "Med position", startLatitude: 57.73, startLongitude: 12.95 }),
      ];
      const { result } = renderHook(() => useTrailFilters(trails, BORAS));

      act(() => result.current.setSortBy("distance-asc"));

      expect(names(result.current.filteredTrails)).toEqual(["Med position", "Utan position"]);
    });

    it("sets length-ascending sort when a length range is applied", () => {
      const { result } = renderHook(() => useTrailFilters(TRAILS, null));

      act(() => result.current.setSortBy("name-desc"));
      act(() => result.current.updateLengthFilter(0, 50));

      expect(result.current.sortBy).toBe("length-asc");
    });
  });

  describe("generic trail types", () => {
    // The hook was made generic so favourites and wishlist entries can reuse it.
    // Extra fields must survive filtering and sorting untouched.
    it("preserves fields beyond FilterableTrail on the returned trails", () => {
      type Favourite = FilterableTrail & { ratingResponse: { rating: number }[] };
      const favourites: Favourite[] = [
        { ...makeTrail({ identifier: "a", name: "Ängsstigen" }), ratingResponse: [{ rating: 4 }] },
        { ...makeTrail({ identifier: "b", name: "Bokskogen" }), ratingResponse: [{ rating: 5 }] },
      ];

      const { result } = renderHook(() => useTrailFilters(favourites, null));

      act(() => result.current.setSearchQuery("bok"));

      expect(result.current.filteredTrails).toHaveLength(1);
      expect(result.current.filteredTrails[0].ratingResponse).toEqual([{ rating: 5 }]);
    });
  });
});
