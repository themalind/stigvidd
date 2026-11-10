// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { EventRouteKind, EventSearchParams, EventSort, LatLng } from "@/data/types";

export type EventWhen = "today" | "weekend" | "week" | "month" | "custom";
export type EventLength = "short" | "mid" | "long";

export interface DateRange {
  from: Date;
  // The last day included. keep-comment: inclusive here, exclusive on the wire
  to: Date;
}

export interface EventFilters {
  when?: EventWhen;
  customRange?: DateRange;
  nearMe: boolean;
  radiusKm: number;
  onlyWithSpots: boolean;
  length?: EventLength;
  routeKind?: EventRouteKind;
  sort: EventSort;
}

export const DEFAULT_EVENT_FILTERS: EventFilters = {
  nearMe: false,
  radiusKm: 25,
  onlyWithSpots: false,
  sort: "Date",
};

// The server caps the radius at 200 km. keep-comment: EventSearchQuery.MaxRadiusKm
export const RADIUS_KM = { min: 5, max: 200, step: 5 };

export const LENGTH_BOUNDS: Record<EventLength, { minLengthKm?: number; maxLengthKm?: number }> = {
  short: { maxLengthKm: 5 },
  mid: { minLengthKm: 5, maxLengthKm: 15 },
  long: { minLengthKm: 15 },
};

// About 100 m, so a walking user does not start a new query on every fix. keep-comment: why the position is rounded
const POSITION_DECIMALS = 3;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function roundPosition(value: number): number {
  const factor = 10 ** POSITION_DECIMALS;
  return Math.round(value * factor) / factor;
}

// Local days, end exclusive. A weekend already under way starts today. keep-comment: the windows
export function dateWindow(when: EventWhen, now: Date, customRange?: DateRange): { from: Date; to: Date } | undefined {
  const today = startOfDay(now);

  switch (when) {
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "weekend": {
      const weekday = today.getDay();
      if (weekday === 6) return { from: today, to: addDays(today, 2) };
      if (weekday === 0) return { from: today, to: addDays(today, 1) };
      const saturday = addDays(today, 6 - weekday);
      return { from: saturday, to: addDays(saturday, 2) };
    }
    case "week":
      return { from: today, to: addDays(today, 7) };
    case "month":
      return { from: today, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    case "custom":
      return customRange
        ? { from: startOfDay(customRange.from), to: addDays(startOfDay(customRange.to), 1) }
        : undefined;
  }
}

// Turning near-me on sorts by distance, and turning it off leaves that sort. keep-comment: same pairing as the trail list
export function changeFilters(previous: EventFilters, patch: Partial<EventFilters>): EventFilters {
  const next = { ...previous, ...patch };
  if (patch.nearMe === true) next.sort = "Distance";
  if (patch.nearMe === false && previous.sort === "Distance" && patch.sort === undefined) next.sort = "Date";
  if (patch.when !== undefined && patch.when !== "custom") next.customRange = undefined;
  return next;
}

// Past lists ignore the date choice, so it does not count there. keep-comment: why past is a parameter
export function activeFilterCount(filters: EventFilters, past = false): number {
  const when = past ? undefined : filters.when;
  return [when, filters.nearMe, filters.onlyWithSpots, filters.length, filters.routeKind].filter(Boolean).length;
}

// Past lists ignore the date choice and newest-first stays the server's; no position means no distance. keep-comment: what each list may send
export function toSearchParams(
  text: string,
  filters: EventFilters,
  location: LatLng | null,
  now: Date,
  past = false,
): EventSearchParams {
  const params: EventSearchParams = {};
  const search = text.trim();
  if (search) params.search = search;

  const window = !past && filters.when ? dateWindow(filters.when, now, filters.customRange) : undefined;
  if (window) {
    params.from = window.from.toISOString();
    params.to = window.to.toISOString();
  }

  const byDistance = filters.sort === "Distance";
  if (location && (filters.nearMe || byDistance)) {
    params.lat = roundPosition(location.latitude);
    params.lon = roundPosition(location.longitude);
    if (filters.nearMe) params.radiusKm = filters.radiusKm;
    if (byDistance) params.sort = "Distance";
  }

  if (filters.onlyWithSpots) params.onlyWithSpots = true;
  if (filters.length) Object.assign(params, LENGTH_BOUNDS[filters.length]);
  if (filters.routeKind) params.routeKind = filters.routeKind;

  return params;
}
