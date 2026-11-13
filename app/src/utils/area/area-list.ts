// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea, FacilityType, hasFacilityType } from "@/data/types";
import { compareSv } from "@/utils/format/compare-sv";

export type AreaSort = "near" | "az";
export type AreaFeature = "swimming" | "firePit" | "shelter" | "accessible";

export const AREA_FEATURES: AreaFeature[] = ["swimming", "firePit", "shelter", "accessible"];

export interface AreaFilters {
  search: string;
  sort: AreaSort;
  municipality: string | null;
  features: AreaFeature[];
}

export const DEFAULT_AREA_FILTERS: AreaFilters = { search: "", sort: "near", municipality: null, features: [] };

export interface AreaGroup {
  // keep-comment: null for the one ungrouped list that "near" shows
  title: string | null;
  areas: CityArea[];
}

const FEATURE_TYPES = {
  swimming: FacilityType.SwimmingArea,
  firePit: FacilityType.FirePit,
  shelter: FacilityType.Shelter,
} as const satisfies Record<Exclude<AreaFeature, "accessible">, number>;

// keep-comment: the combining diacritics block, written escaped; Hermes support for \p{Mn} is not documented
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function fold(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

export function hasFeature(area: CityArea, feature: AreaFeature): boolean {
  if (feature === "accessible") {
    return area.trails.some((t) => t.isAccessible) || area.facilities.some((f) => f.isAccessible);
  }
  return area.facilities.some((f) => hasFacilityType(f.facilityType, FEATURE_TYPES[feature]));
}

export function areaFeatures(area: CityArea): AreaFeature[] {
  return AREA_FEATURES.filter((feature) => hasFeature(area, feature));
}

export function areaMunicipalities(areas: CityArea[]): string[] {
  const names = new Set(areas.flatMap((area) => (area.municipality ? [area.municipality] : [])));
  return [...names].sort(compareSv);
}

function matches(area: CityArea, filters: AreaFilters): boolean {
  const query = fold(filters.search.trim());
  const named =
    query === "" || [area.name, area.location, area.municipality ?? ""].some((t) => fold(t).includes(query));
  const inMunicipality = filters.municipality === null || area.municipality === filters.municipality;
  return named && inMunicipality && filters.features.every((feature) => hasFeature(area, feature));
}

// keep-comment: "near" keeps the API's order (nearest, or most popular without a position); "az" groups by municipality
export function groupAreas(areas: CityArea[], filters: AreaFilters, otherMunicipality: string): AreaGroup[] {
  const shown = areas.filter((area) => matches(area, filters));
  if (filters.sort === "near") return shown.length === 0 ? [] : [{ title: null, areas: shown }];

  const groups = new Map<string, CityArea[]>();
  for (const area of shown) {
    const key = area.municipality ?? otherMunicipality;
    groups.set(key, [...(groups.get(key) ?? []), area]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === otherMunicipality ? 1 : b === otherMunicipality ? -1 : compareSv(a, b)))
    .map(([title, group]) => ({ title, areas: [...group].sort((a, b) => compareSv(a.name, b.name)) }));
}
