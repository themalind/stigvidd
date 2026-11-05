// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminAreaSuggestionResponse } from "@/api/generated/model";

// keep-comment: mirrors CityAreaSuggester.NearbyKm; farther than this the API suggests nothing
export const NEARBY_KM = 5;

export const NO_SUGGESTION = `No area within ${NEARBY_KM} km`;

export interface UnlinkedRow {
  identifier: string;
  label: string;
  detail?: string;
  suggestions: AdminAreaSuggestionResponse[];
}

function kilometres(km: number): string {
  return `${km.toLocaleString("en", { maximumFractionDigits: 1 })} km`;
}

export function suggestionReason(suggestion: AdminAreaSuggestionResponse): string {
  const away = suggestion.distanceKm === null ? undefined : kilometres(suggestion.distanceKm);
  if (suggestion.reason === "Name") return away ? `name, ${away}` : "name";
  return away ?? "nearby";
}

export function suggestionTitle(suggestion: AdminAreaSuggestionResponse): string {
  const closest =
    suggestion.distanceKm === null || suggestion.nearestName === null
      ? undefined
      : `${kilometres(suggestion.distanceKm)} from ${suggestion.nearestName.trim()}`;
  if (suggestion.reason === "Name")
    return [`The name mentions ${suggestion.areaName}`, closest].filter(Boolean).join(", ");
  return closest ?? `Near ${suggestion.areaName}`;
}

// keep-comment: grouped by first suggested area so a run of rows can be linked to the same place; rows without one go last
export function bySuggestedArea(a: UnlinkedRow, b: UnlinkedRow): number {
  const first = a.suggestions.at(0)?.areaName;
  const second = b.suggestions.at(0)?.areaName;
  if (first !== undefined && second === undefined) return -1;
  if (first === undefined && second !== undefined) return 1;
  const area = (first ?? "").localeCompare(second ?? "", "sv");
  return area !== 0 ? area : a.label.localeCompare(b.label, "sv");
}
