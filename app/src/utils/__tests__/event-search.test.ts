// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  activeFilterCount,
  changeFilters,
  dateWindow,
  DEFAULT_EVENT_FILTERS,
  EventFilters,
  toSearchParams,
} from "@/utils/event-search";

// Thursday 5 November 2026, mid-afternoon local time.
const THURSDAY = new Date(2026, 10, 5, 15, 20);
const BORAS = { latitude: 57.72106, longitude: 12.93987 };

const day = (date: number, month = 10) => new Date(2026, month, date);

describe("dateWindow", () => {
  it("covers today from midnight to midnight", () => {
    expect(dateWindow("today", THURSDAY)).toEqual({ from: day(5), to: day(6) });
  });

  it("is the coming Saturday and Sunday on a weekday", () => {
    expect(dateWindow("weekend", THURSDAY)).toEqual({ from: day(7), to: day(9) });
  });

  it("starts today once the weekend is under way", () => {
    expect(dateWindow("weekend", new Date(2026, 10, 7, 12))).toEqual({ from: day(7), to: day(9) });
    expect(dateWindow("weekend", new Date(2026, 10, 8, 12))).toEqual({ from: day(8), to: day(9) });
  });

  it("runs seven days for the week and to the first of next month for the month", () => {
    expect(dateWindow("week", THURSDAY)).toEqual({ from: day(5), to: day(12) });
    expect(dateWindow("month", THURSDAY)).toEqual({ from: day(5), to: day(1, 11) });
  });

  it("includes the last chosen day of a custom range", () => {
    expect(dateWindow("custom", THURSDAY, { from: new Date(2026, 10, 20, 9), to: day(22) })).toEqual({
      from: day(20),
      to: day(23),
    });
    expect(dateWindow("custom", THURSDAY)).toBeUndefined();
  });
});

describe("toSearchParams", () => {
  const filters = (patch: Partial<EventFilters>): EventFilters => ({ ...DEFAULT_EVENT_FILTERS, ...patch });

  it("sends nothing for an empty search", () => {
    expect(toSearchParams("  ", DEFAULT_EVENT_FILTERS, BORAS, THURSDAY)).toEqual({});
  });

  it("trims the text and sends the window as UTC strings", () => {
    expect(toSearchParams(" Kypesjön ", filters({ when: "today" }), null, THURSDAY)).toEqual({
      search: "Kypesjön",
      from: day(5).toISOString(),
      to: day(6).toISOString(),
    });
  });

  it("leaves the window out of a past list", () => {
    expect(toSearchParams("", filters({ when: "today" }), null, THURSDAY, true)).toEqual({});
  });

  it("sends a rounded position with the radius and distance sort when near me is on", () => {
    expect(toSearchParams("", filters({ nearMe: true, radiusKm: 40, sort: "Distance" }), BORAS, THURSDAY)).toEqual({
      lat: 57.721,
      lon: 12.94,
      radiusKm: 40,
      sort: "Distance",
    });
  });

  it("drops everything that needs a position when there is none", () => {
    expect(toSearchParams("", filters({ nearMe: true, sort: "Distance" }), null, THURSDAY)).toEqual({});
  });

  it("maps the length choice and the other filters", () => {
    expect(
      toSearchParams("", filters({ length: "mid", routeKind: "Own", onlyWithSpots: true }), null, THURSDAY),
    ).toEqual({ minLengthKm: 5, maxLengthKm: 15, routeKind: "Own", onlyWithSpots: true });
    expect(toSearchParams("", filters({ length: "short" }), null, THURSDAY)).toEqual({ maxLengthKm: 5 });
    expect(toSearchParams("", filters({ length: "long" }), null, THURSDAY)).toEqual({ minLengthKm: 15 });
  });
});

describe("changeFilters", () => {
  it("sorts by distance when near me turns on and back to date when it turns off", () => {
    const near = changeFilters(DEFAULT_EVENT_FILTERS, { nearMe: true });
    expect(near.sort).toBe("Distance");
    expect(changeFilters(near, { nearMe: false }).sort).toBe("Date");
  });

  it("keeps an explicit distance sort given with the same change", () => {
    expect(changeFilters(DEFAULT_EVENT_FILTERS, { nearMe: false, sort: "Distance" }).sort).toBe("Distance");
  });

  it("forgets the custom range when another window is chosen", () => {
    const custom = changeFilters(DEFAULT_EVENT_FILTERS, {
      when: "custom",
      customRange: { from: day(20), to: day(22) },
    });
    expect(changeFilters(custom, { when: "week" }).customRange).toBeUndefined();
  });
});

describe("activeFilterCount", () => {
  it("counts the filters but not the sort", () => {
    expect(activeFilterCount(DEFAULT_EVENT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_EVENT_FILTERS,
        when: "week",
        nearMe: true,
        onlyWithSpots: true,
        sort: "Distance",
      }),
    ).toBe(3);
  });

  it("leaves the date choice out for a past list", () => {
    expect(activeFilterCount({ ...DEFAULT_EVENT_FILTERS, when: "week", onlyWithSpots: true }, true)).toBe(1);
  });
});
