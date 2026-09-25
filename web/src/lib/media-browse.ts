// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminMediaGetAllParams, MediaFilter, MediaItemResponse } from "@/api/generated/model";
import { NEEDS_WORK_PRESET, presetByKey, type ReprocessPreset } from "./media-reprocess";

export const MediaPageSize = 48;

// Mirrors MediaSorts.All on the backend; the API rejects anything else with a 400.
export const MEDIA_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "largest", label: "Largest first" },
  { value: "widest", label: "Widest first" },
] as const;

export type MediaSortValue = (typeof MEDIA_SORTS)[number]["value"];

export type MediaFilterState = {
  ownerType: string;
  format: string;
  needsWork: boolean;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  minSizeKb: string;
  maxSizeKb: string;
  uploadedFrom: string;
  uploadedTo: string;
};

export const emptyMediaFilters: MediaFilterState = {
  ownerType: "All",
  format: "All",
  needsWork: false,
  minWidth: "",
  maxWidth: "",
  minHeight: "",
  maxHeight: "",
  minSizeKb: "",
  maxSizeKb: "",
  uploadedFrom: "",
  uploadedTo: "",
};

function numeric(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function choice(value: string): string | undefined {
  return value === "All" || value.trim() === "" ? undefined : value;
}

// keep-comment: <input type="date"> gives a local yyyy-mm-dd; the API's CreatedTo is exclusive, so the bound sent is the following day or every image uploaded on the chosen date drops out of a filter that names it
function exclusiveEnd(value: string): string | undefined {
  if (value.trim() === "") return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString();
}

function inclusiveStart(value: string): string | undefined {
  if (value.trim() === "") return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * The listing filter as the generated client wants it. Every absent value is `undefined`,
 * never `null` and never `NaN` — the generated URL builder appends anything that is not
 * `undefined`, and would send the literal string "null".
 */
export function toMediaQuery(
  filters: MediaFilterState,
  preset: ReprocessPreset = presetByKey(NEEDS_WORK_PRESET),
): AdminMediaGetAllParams {
  const query: AdminMediaGetAllParams = {
    OwnerType: choice(filters.ownerType),
    Format: choice(filters.format),
    MinWidth: numeric(filters.minWidth),
    MaxWidth: numeric(filters.maxWidth),
    MinHeight: numeric(filters.minHeight),
    MaxHeight: numeric(filters.maxHeight),
    CreatedFrom: inclusiveStart(filters.uploadedFrom),
    CreatedTo: exclusiveEnd(filters.uploadedTo),
  };

  const minKb = numeric(filters.minSizeKb);
  const maxKb = numeric(filters.maxSizeKb);
  if (minKb !== undefined) query.MinSizeBytes = minKb * 1024;
  if (maxKb !== undefined) query.MaxSizeBytes = maxKb * 1024;

  if (filters.needsWork) {
    query.TargetMaxWidth = Number(preset.resolution);
    query.TargetFormat = preset.format;
  }

  for (const key of Object.keys(query) as (keyof AdminMediaGetAllParams)[]) {
    if (query[key] === undefined) delete query[key];
  }

  return query;
}

// keep-comment: the same filter in the shape the reprocess body wants - ASP.NET binds the query string by property name (PascalCase) while the JSON body is camelCase, so the two spellings are not interchangeable
export function toMediaFilter(
  filters: MediaFilterState,
  preset: ReprocessPreset = presetByKey(NEEDS_WORK_PRESET),
): MediaFilter {
  const query = toMediaQuery(filters, preset);

  return {
    ownerType: query.OwnerType,
    format: query.Format,
    minWidth: query.MinWidth,
    maxWidth: query.MaxWidth,
    minHeight: query.MinHeight,
    maxHeight: query.MaxHeight,
    minSizeBytes: query.MinSizeBytes,
    maxSizeBytes: query.MaxSizeBytes,
    createdFrom: query.CreatedFrom,
    createdTo: query.CreatedTo,
    targetMaxWidth: query.TargetMaxWidth,
    targetFormat: query.TargetFormat,
  };
}

export function isFiltered(filters: MediaFilterState): boolean {
  return describeMediaFilters(filters).length > 0;
}

export function describeMediaFilters(filters: MediaFilterState): string[] {
  const parts: string[] = [];

  if (filters.needsWork) parts.push("needs work");
  if (choice(filters.ownerType)) parts.push(filters.ownerType);
  if (choice(filters.format)) parts.push(filters.format.toUpperCase());
  if (numeric(filters.minWidth) !== undefined) parts.push(`≥ ${filters.minWidth} px wide`);
  if (numeric(filters.maxWidth) !== undefined) parts.push(`≤ ${filters.maxWidth} px wide`);
  if (numeric(filters.minHeight) !== undefined) parts.push(`≥ ${filters.minHeight} px tall`);
  if (numeric(filters.maxHeight) !== undefined) parts.push(`≤ ${filters.maxHeight} px tall`);
  if (numeric(filters.minSizeKb) !== undefined) parts.push(`≥ ${filters.minSizeKb} KB`);
  if (numeric(filters.maxSizeKb) !== undefined) parts.push(`≤ ${filters.maxSizeKb} KB`);
  if (inclusiveStart(filters.uploadedFrom)) parts.push(`from ${filters.uploadedFrom}`);
  if (exclusiveEnd(filters.uploadedTo)) parts.push(`to ${filters.uploadedTo}`);

  return parts;
}

/**
 * Whether the preset would resize or re-encode this image. It answers the size and format
 * half only: quality is stored nowhere, so an already-compact image saved at a higher
 * quality shows no marker and would still shrink.
 */
export function wouldBeChangedBy(item: MediaItemResponse, preset: ReprocessPreset): boolean {
  const max = Number(preset.resolution);
  if (!Number.isFinite(max)) return false;

  const width = item.width ?? 0;
  const height = item.height ?? 0;

  if (width <= 0 || height <= 0) return true;
  if (width > max || height > max) return true;

  return item.format !== preset.format;
}

/** Trail symbols carry no stored dimensions and can never be batch-reprocessed. */
export function selectableMedia(items: readonly MediaItemResponse[]): MediaItemResponse[] {
  return items.filter((item) => item.ownerType !== "TrailSymbol");
}

export type PageSelection = { onPage: number; whole: boolean };

export function pageSelection(
  selected: ReadonlySet<string>,
  items: readonly MediaItemResponse[] | null,
): PageSelection {
  if (items === null) return { onPage: 0, whole: false };

  const selectable = selectableMedia(items);
  const onPage = selectable.filter((item) => selected.has(item.identifier)).length;

  return { onPage, whole: selectable.length > 0 && onPage === selectable.length };
}

export function togglePageSelection(
  selected: ReadonlySet<string>,
  items: readonly MediaItemResponse[],
): Set<string> {
  const next = new Set(selected);
  const selectable = selectableMedia(items);
  const allOn = selectable.length > 0 && selectable.every((item) => next.has(item.identifier));

  for (const item of selectable) {
    if (allOn) next.delete(item.identifier);
    else next.add(item.identifier);
  }

  return next;
}

/**
 * Offered once the page is exhausted and the filter still holds more — otherwise "select
 * all" quietly means "select these forty-eight".
 */
export function canSelectAllMatching(
  page: PageSelection,
  reprocessableCount: number,
  selected: ReadonlySet<string>,
  allMatching: boolean,
): boolean {
  return page.whole && !allMatching && reprocessableCount > selected.size;
}
