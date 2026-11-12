// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  FacilityImportField,
  FacilityImportKeepRequest,
  FacilityImportLinkRequest,
  FacilityImportRowKind,
  FacilityImportRowResponse,
} from "@/api/generated/model";
import type { Choices } from "@/features/facility-import/api/facility-import";
import { facilityTypeLabel } from "@/utils/facility-types";

// keep-comment: the select's value for "create a new facility"; any other value is the facility to link to
export const CREATE_NEW = "";

const kindOrder: FacilityImportRowKind[] = ["New", "Changed", "Missing", "Unchanged"];

export const kindLabel: Record<FacilityImportRowKind, string> = {
  New: "New",
  Changed: "Changed",
  Missing: "Gone from source",
  Unchanged: "Unchanged",
};

export const fieldLabel: Record<FacilityImportField, string> = {
  Name: "Name",
  Description: "Description",
  Url: "Link",
  Coordinates: "Position",
  Type: "Type",
};

// keep-comment: a Type change carries the facility type flags as a number, such as "3"
export function changeText(field: FacilityImportField, value: string): string {
  return field === "Type" ? facilityTypeLabel(Number(value)) : value;
}

export function sortRows(rows: readonly FacilityImportRowResponse[]): FacilityImportRowResponse[] {
  return [...rows].sort(
    (a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || a.name.localeCompare(b.name, "sv"),
  );
}

export function countByKind(rows: readonly FacilityImportRowResponse[]): Record<FacilityImportRowKind, number> {
  const counts: Record<FacilityImportRowKind, number> = { New: 0, Changed: 0, Missing: 0, Unchanged: 0 };

  for (const row of rows) counts[row.kind] += 1;

  return counts;
}

// keep-comment: a new source row that joins a facility we already have rather than creating one
export function isLink(row: FacilityImportRowResponse): boolean {
  return row.kind === "New" && Boolean(row.facilityIdentifier);
}

function chosenLinks(rows: readonly FacilityImportRowResponse[]): FacilityImportLinkRequest[] {
  return rows
    .filter((row) => row.kind === "New")
    .map((row) => ({ sourceId: row.sourceId, facilityIdentifier: row.facilityIdentifier ?? null }));
}

// keep-comment: only choices that differ from the server's suggestion; it applies the suggestion to the rest
export function linksOf(rows: readonly FacilityImportRowResponse[]): FacilityImportLinkRequest[] {
  const suggested = new Map<string | undefined, string | null>(
    rows.map((row) => [row.sourceId, row.suggestedFacilityIdentifier ?? null]),
  );

  return chosenLinks(rows).filter((link) => link.facilityIdentifier !== suggested.get(link.sourceId));
}

// keep-comment: the fields the preview keeps as ours, sent back like the links
export function keptOf(rows: readonly FacilityImportRowResponse[]): FacilityImportKeepRequest[] {
  return rows.flatMap((row) =>
    row.changes.filter((change) => change.kept).map((change) => ({ sourceId: row.sourceId, field: change.field })),
  );
}

// keep-comment: shows a choice at once; the preview it triggers then replaces the rows with the server's plan
export function markChoice(
  rows: readonly FacilityImportRowResponse[],
  sourceId: string,
  choice: string,
): FacilityImportRowResponse[] {
  return rows.map((row) =>
    row.sourceId === sourceId
      ? { ...row, facilityIdentifier: choice === CREATE_NEW ? null : choice, facilityName: null }
      : row,
  );
}

export function markKept(
  rows: readonly FacilityImportRowResponse[],
  sourceId: string,
  field: FacilityImportField,
  keep: boolean,
): FacilityImportRowResponse[] {
  return rows.map((row) =>
    row.sourceId === sourceId
      ? { ...row, changes: row.changes.map((change) => (change.field === field ? { ...change, kept: keep } : change)) }
      : row,
  );
}

export function choicesOf(rows: readonly FacilityImportRowResponse[]): Choices {
  return { links: linksOf(rows), kept: keptOf(rows) };
}

// keep-comment: one facility can take one source row; a second pick would be refused by the server
export function takenElsewhere(rows: readonly FacilityImportRowResponse[], sourceId: string): Set<string> {
  return new Set(
    chosenLinks(rows)
      .filter((link) => link.sourceId !== sourceId)
      .map((link) => link.facilityIdentifier)
      .filter((identifier) => identifier !== null && identifier !== undefined),
  );
}
