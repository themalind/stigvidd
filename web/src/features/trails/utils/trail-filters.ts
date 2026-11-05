// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItemResponse } from "@/api/generated/model";
import { matchesAll, searchTerms } from "@/utils/search";

export const TRAIL_MISSING = [
  { value: "All", label: "Missing anything" },
  { value: "Images", label: "Missing images" },
  { value: "ExampleImages", label: "Has example images" },
  { value: "Symbol", label: "Missing symbol" },
  { value: "Description", label: "Missing short description" },
  { value: "FullDescription", label: "Missing full description" },
] as const;

export const TRAIL_UPDATED = [
  { value: "All", label: "Updated any time" },
  { value: "1", label: "Updated last 24 h" },
  { value: "7", label: "Updated last 7 days" },
  { value: "30", label: "Updated last 30 days" },
] as const;

export const TRAIL_SORTS = [
  { value: "Name", label: "Name A–Ö" },
  { value: "Newest", label: "Newest first" },
  { value: "RecentlyUpdated", label: "Recently updated" },
  { value: "Shortest", label: "Shortest first" },
  { value: "Longest", label: "Longest first" },
] as const;

export type TrailFilterState = {
  query: string;
  city: string;
  status: "All" | "Active" | "Inactive";
  classification: string;
  accessibility: "All" | "Accessible" | "NotAccessible";
  missing: (typeof TRAIL_MISSING)[number]["value"];
  updatedWithinDays: (typeof TRAIL_UPDATED)[number]["value"];
  minKm: string;
  maxKm: string;
  sort: (typeof TRAIL_SORTS)[number]["value"];
};

export const emptyTrailFilters: TrailFilterState = {
  query: "",
  city: "All",
  status: "All",
  classification: "All",
  accessibility: "All",
  missing: "All",
  updatedWithinDays: "All",
  minKm: "",
  maxKm: "",
  sort: "Name",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function km(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isMissing(trail: AdminTrailListItemResponse, missing: TrailFilterState["missing"]): boolean {
  switch (missing) {
    case "Images":
      return !trail.hasImages;
    case "ExampleImages":
      return trail.hasExampleImages;
    case "Symbol":
      return !trail.hasSymbol;
    case "Description":
      return !trail.hasDescription;
    case "FullDescription":
      return !trail.hasFullDescription;
    case "All":
      return true;
  }
}

function compare(
  sort: TrailFilterState["sort"],
): (a: AdminTrailListItemResponse, b: AdminTrailListItemResponse) => number {
  const byName = (a: AdminTrailListItemResponse, b: AdminTrailListItemResponse) => a.name.localeCompare(b.name, "sv");
  switch (sort) {
    case "Newest":
      return (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || byName(a, b);
    case "RecentlyUpdated":
      return (a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt) || byName(a, b);
    case "Shortest":
      return (a, b) => a.trailLength - b.trailLength || byName(a, b);
    case "Longest":
      return (a, b) => b.trailLength - a.trailLength || byName(a, b);
    case "Name":
      return byName;
  }
}

function oneOf<T extends string>(value: string | null, options: readonly { value: T }[]): T | undefined {
  return options.find((option) => option.value === value)?.value;
}

export const TRAIL_STATUSES = [
  { value: "All", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
] as const;

export const TRAIL_ACCESSIBILITY = [
  { value: "All", label: "Any accessibility" },
  { value: "Accessible", label: "Accessible" },
  { value: "NotAccessible", label: "Not accessible" },
] as const;

export type TrailTextFilters = Pick<TrailFilterState, "query" | "minKm" | "maxKm">;
export type TrailSearchFilters = Omit<TrailFilterState, keyof TrailTextFilters>;

// keep-comment: the choices live in the address; free text stays out of it, so typing adds no history entries
export const trailSearchDefaults: Record<keyof TrailSearchFilters, string> = {
  city: emptyTrailFilters.city,
  status: emptyTrailFilters.status,
  classification: emptyTrailFilters.classification,
  accessibility: emptyTrailFilters.accessibility,
  missing: emptyTrailFilters.missing,
  updatedWithinDays: emptyTrailFilters.updatedWithinDays,
  sort: emptyTrailFilters.sort,
};

export function filtersFromSearch(values: Partial<Record<keyof TrailSearchFilters, string>>): TrailSearchFilters {
  return {
    city: values.city ?? emptyTrailFilters.city,
    classification: values.classification ?? emptyTrailFilters.classification,
    status: oneOf(values.status ?? null, TRAIL_STATUSES) ?? emptyTrailFilters.status,
    accessibility: oneOf(values.accessibility ?? null, TRAIL_ACCESSIBILITY) ?? emptyTrailFilters.accessibility,
    missing: oneOf(values.missing ?? null, TRAIL_MISSING) ?? emptyTrailFilters.missing,
    updatedWithinDays: oneOf(values.updatedWithinDays ?? null, TRAIL_UPDATED) ?? emptyTrailFilters.updatedWithinDays,
    sort: oneOf(values.sort ?? null, TRAIL_SORTS) ?? emptyTrailFilters.sort,
  };
}

export function trailCities(trails: AdminTrailListItemResponse[]): string[] {
  return [...new Set(trails.map((t) => t.city).filter((city) => city.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b, "sv"),
  );
}

export function filterTrails(
  trails: AdminTrailListItemResponse[],
  filters: TrailFilterState,
  now: number = Date.now(),
): AdminTrailListItemResponse[] {
  const terms = searchTerms(filters.query);
  const minKm = km(filters.minKm);
  const maxKm = km(filters.maxKm);
  const updatedSince =
    filters.updatedWithinDays === "All" ? undefined : now - Number(filters.updatedWithinDays) * DAY_MS;

  return trails
    .filter((trail) => {
      if (filters.status === "Active" && !trail.isVerified) return false;
      if (filters.status === "Inactive" && trail.isVerified) return false;
      if (filters.city !== "All" && trail.city !== filters.city) return false;
      if (filters.classification !== "All" && trail.classification !== Number(filters.classification)) return false;
      if (filters.accessibility === "Accessible" && !trail.accessibility) return false;
      if (filters.accessibility === "NotAccessible" && trail.accessibility) return false;
      if (filters.missing !== "All" && !isMissing(trail, filters.missing)) return false;
      if (updatedSince !== undefined && Date.parse(trail.lastUpdatedAt) < updatedSince) return false;
      if (minKm !== undefined && trail.trailLength < minKm) return false;
      if (maxKm !== undefined && trail.trailLength > maxKm) return false;

      return matchesAll(`${trail.name} ${trail.city} ${trail.identifier}`, terms);
    })
    .sort(compare(filters.sort));
}
