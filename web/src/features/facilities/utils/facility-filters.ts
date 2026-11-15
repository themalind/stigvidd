// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminFacilityResponse } from "@/api/generated/model";
import { FACILITY_TYPES } from "@/utils/facility-types";
import { matchesAll, searchTerms } from "@/utils/search";

export const HAND_ENTERED = "Hand";

export const FACILITY_POSITIONS = [
  { value: "All", label: "Any position" },
  { value: "Has", label: "On the map" },
  { value: "Missing", label: "No position" },
] as const;

export const FACILITY_AREAS = [
  { value: "All", label: "Any area" },
  { value: "None", label: "In no area" },
] as const;

export const FACILITY_DUPLICATES = [
  { value: "All", label: "All facilities" },
  { value: "Likely", label: "Likely duplicates" },
] as const;

export const FACILITY_SORTS = [
  { value: "Name", label: "Name A–Ö" },
  { value: "RecentlyUpdated", label: "Recently updated" },
] as const;

export type FacilityFilterState = {
  query: string;
  type: string;
  source: string;
  position: (typeof FACILITY_POSITIONS)[number]["value"];
  area: (typeof FACILITY_AREAS)[number]["value"];
  duplicates: (typeof FACILITY_DUPLICATES)[number]["value"];
  sort: (typeof FACILITY_SORTS)[number]["value"];
};

export type FacilitySearchFilters = Omit<FacilityFilterState, "query">;

// keep-comment: the choices live in the address; free text stays out of it, so typing adds no history entries
export const facilitySearchDefaults: Record<keyof FacilitySearchFilters, string> = {
  type: "All",
  source: "All",
  position: "All",
  area: "All",
  duplicates: "All",
  sort: "Name",
};

function oneOf<T extends string>(value: string | undefined, options: readonly { value: T }[]): T | undefined {
  return options.find((option) => option.value === value)?.value;
}

export function filtersFromSearch(values: Partial<Record<keyof FacilitySearchFilters, string>>): FacilitySearchFilters {
  return {
    type: FACILITY_TYPES.some(([bit]) => String(bit) === values.type) ? (values.type ?? "All") : "All",
    source: values.source ?? "All",
    position: oneOf(values.position, FACILITY_POSITIONS) ?? "All",
    area: oneOf(values.area, FACILITY_AREAS) ?? "All",
    duplicates: oneOf(values.duplicates, FACILITY_DUPLICATES) ?? "All",
    sort: oneOf(values.sort, FACILITY_SORTS) ?? "Name",
  };
}

export function facilitySources(facilities: AdminFacilityResponse[]): string[] {
  const keys = facilities.map((facility) => facility.sourceKey).filter((key): key is string => key !== null);
  return [...new Set(keys)].sort((a, b) => a.localeCompare(b, "sv"));
}

// keep-comment: the API's nameKey is the import's "same place" rule; facilities sharing a non-empty one are likely duplicates
function likelyDuplicates(facilities: AdminFacilityResponse[]): Set<string> {
  const counts = new Map<string, number>();
  for (const { nameKey } of facilities) {
    if (nameKey !== "") counts.set(nameKey, (counts.get(nameKey) ?? 0) + 1);
  }

  return new Set(
    facilities.filter((facility) => (counts.get(facility.nameKey) ?? 0) > 1).map((facility) => facility.identifier),
  );
}

function compare(sort: FacilityFilterState["sort"]) {
  const byName = (a: AdminFacilityResponse, b: AdminFacilityResponse) => a.name.localeCompare(b.name, "sv");
  if (sort === "RecentlyUpdated") {
    return (a: AdminFacilityResponse, b: AdminFacilityResponse) =>
      Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt) || byName(a, b);
  }
  return byName;
}

export function filterFacilities(
  facilities: AdminFacilityResponse[],
  filters: FacilityFilterState,
): AdminFacilityResponse[] {
  const terms = searchTerms(filters.query);
  const duplicates = filters.duplicates === "Likely" ? likelyDuplicates(facilities) : null;
  const type = filters.type === "All" ? 0 : Number(filters.type);

  return facilities
    .filter((facility) => {
      if (type !== 0 && (facility.facilityType & type) === 0) return false;
      if (filters.source === HAND_ENTERED && facility.sourceId !== null) return false;
      if (filters.source !== "All" && filters.source !== HAND_ENTERED && facility.sourceKey !== filters.source)
        return false;
      const placed = facility.latitude !== null && facility.longitude !== null;
      if (filters.position === "Has" && !placed) return false;
      if (filters.position === "Missing" && placed) return false;
      if (filters.area === "None" && facility.areaNames.length > 0) return false;
      if (duplicates && !duplicates.has(facility.identifier)) return false;

      return matchesAll(
        `${facility.name} ${facility.location} ${facility.areaNames.join(" ")} ${facility.identifier}`,
        terms,
      );
    })
    .sort(
      duplicates
        ? (a, b) => a.nameKey.localeCompare(b.nameKey, "sv") || compare(filters.sort)(a, b)
        : compare(filters.sort),
    );
}
