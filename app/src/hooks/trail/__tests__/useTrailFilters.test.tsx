// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { FilterableTrail, trailRating, useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

function trail(overrides: Partial<FilterableTrail> & { identifier: string }): FilterableTrail {
  return {
    name: overrides.identifier,
    trailLength: 5,
    accessibility: false,
    classification: 1,
    city: "Borås",
    ...overrides,
  };
}

// The trail list hands down one average; a saved trail hands down the ratings themselves.
const LISTED = [
  trail({ identifier: "unrated", averageRating: 0 }),
  trail({ identifier: "three", averageRating: 3 }),
  trail({ identifier: "four-two", averageRating: 4.2 }),
  trail({ identifier: "five", averageRating: 5 }),
];

const SAVED = [
  trail({ identifier: "saved-none", ratingResponse: [] }),
  trail({ identifier: "saved-four", ratingResponse: [{ rating: 5 }, { rating: 3 }] }),
];

function renderFilters(trails: FilterableTrail[]) {
  let hook!: ReturnType<typeof useTrailFilters<FilterableTrail>>;
  function Probe() {
    hook = useTrailFilters(trails, null);
    return null;
  }
  renderWithProviders(<Probe />);
  return {
    ids: () => hook.filteredTrails.map((t) => t.identifier),
    setFilter: (key: Parameters<typeof hook.updateFilter>[0], value: unknown) =>
      act(() => hook.updateFilter(key, value)),
    sortBy: () => hook.sortBy,
    setSort: (value: Parameters<typeof hook.setSortBy>[0]) => act(() => hook.setSortBy(value)),
    clear: () => act(() => hook.clearFilters()),
  };
}

describe("reading a trail's rating", () => {
  it("prefers the average the list already carries", () => {
    expect(trailRating(trail({ identifier: "a", averageRating: 4.2, ratingResponse: [{ rating: 1 }] }))).toBe(4.2);
  });

  it("averages the individual ratings when that is all there is", () => {
    expect(trailRating(trail({ identifier: "a", ratingResponse: [{ rating: 5 }, { rating: 4 }] }))).toBe(4.5);
  });

  it("reads an unreviewed trail as zero however it was given", () => {
    expect(trailRating(trail({ identifier: "a", averageRating: 0 }))).toBe(0);
    expect(trailRating(trail({ identifier: "a", ratingResponse: [] }))).toBe(0);
    expect(trailRating(trail({ identifier: "a" }))).toBe(0);
  });
});

describe("filtering on rating", () => {
  it("keeps only the trails at or above the chosen step", () => {
    const f = renderFilters(LISTED);

    f.setFilter("minRating", 4);

    expect(f.ids()).toEqual(["five", "four-two"]);
  });

  it("counts a rating exactly on the step", () => {
    const f = renderFilters(LISTED);

    f.setFilter("minRating", 3);

    expect(f.ids()).toContain("three");
  });

  // 0 is "no reviews", not a bad trail, but it cannot satisfy "at least three stars".
  it("drops unreviewed trails from every step", () => {
    const f = renderFilters(LISTED);

    f.setFilter("minRating", 3);

    expect(f.ids()).not.toContain("unrated");
  });

  it("filters a saved trail on its own ratings", () => {
    const f = renderFilters(SAVED);

    f.setFilter("minRating", 4);

    expect(f.ids()).toEqual(["saved-four"]);
  });

  it("puts every trail back when the step is cleared", () => {
    const f = renderFilters(LISTED);

    f.setFilter("minRating", 4.5);
    expect(f.ids()).toEqual(["five"]);

    f.setFilter("minRating", undefined);
    expect(f.ids()).toHaveLength(LISTED.length);
  });
});

describe("sorting on rating", () => {
  it("orders best first, and worst first the other way", () => {
    const f = renderFilters(LISTED);

    f.setSort("rating-desc");
    expect(f.ids()).toEqual(["five", "four-two", "three", "unrated"]);

    f.setSort("rating-asc");
    expect(f.ids()).toEqual(["unrated", "three", "four-two", "five"]);
  });

  // A minimum rating carries its own order, as "near me" already does.
  it("switches to best-first as soon as a minimum rating is chosen", () => {
    const f = renderFilters(LISTED);

    f.setFilter("minRating", 3);

    expect(f.sortBy()).toBe("rating-desc");
    expect(f.ids()).toEqual(["five", "four-two", "three"]);
  });

  it("leaves the order alone when the rating filter is cleared", () => {
    const f = renderFilters(LISTED);

    f.setSort("name-asc");
    f.setFilter("minRating", undefined);

    expect(f.sortBy()).toBe("name-asc");
  });

  it("returns to the default order when the filters are cleared", () => {
    const f = renderFilters(LISTED);

    f.setFilter("minRating", 4);
    f.clear();

    expect(f.sortBy()).toBe("name-asc");
    expect(f.ids()).toHaveLength(LISTED.length);
  });
});
