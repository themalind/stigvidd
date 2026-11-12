// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { FacilityImportMappingRequest, FacilityImportMappingResponse } from "@/api/generated/model";
import type { FileField, FileSummary } from "./inspect";

// keep-comment: the select value for "no field"; for the id it means matching on position
export const NO_FIELD = "";
// keep-comment: a type value mapped to 0 is left out of the import
export const LEAVE_OUT = 0;

export interface MappingDraft {
  idField: string;
  nameField: string;
  descriptionField: string;
  urlField: string;
  typeField: string;
  fixedType: number;
  typeValues: Record<string, number>;
}

// keep-comment: common names in Swedish municipal exports; fid is left out on purpose, it is a row number that changes between exports
const FIELD_NAMES = {
  idField: ["place_id", "id", "objectid", "globalid", "uuid"],
  nameField: ["name", "namn", "benamning", "benämning", "title", "titel"],
  descriptionField: ["description", "beskrivning", "info", "information"],
  urlField: ["visit_url", "url", "link", "lank", "länk", "webbadress"],
  typeField: ["typ", "type", "kategori", "category"],
} as const;

const TYPE_WORDS: readonly [RegExp, number][] = [
  [/grill|eldplats|fire/i, 1],
  [/vindskydd|shelter|kåta/i, 2],
  [/fiske|fishing/i, 4],
  [/bad|swim/i, 8],
  [/naturreservat|reserve/i, 16],
];

function pick(fields: readonly FileField[], names: readonly string[]): string {
  const byName = new Map(fields.map((field) => [field.name.toLowerCase(), field.name]));
  return names.map((name) => byName.get(name)).find((name) => name !== undefined) ?? NO_FIELD;
}

export function guessType(value: string): number {
  return TYPE_WORDS.find(([pattern]) => pattern.test(value))?.[1] ?? LEAVE_OUT;
}

export function valuesOf(summary: FileSummary, field: string): string[] {
  return summary.fields.find((f) => f.name === field)?.values ?? [];
}

export function guessTypeValues(values: readonly string[], known: Record<string, number> = {}): Record<string, number> {
  return Object.fromEntries(values.map((value) => [value, known[value] ?? guessType(value)]));
}

export function guessMapping(summary: FileSummary): MappingDraft {
  const typeCandidate = pick(summary.fields, FIELD_NAMES.typeField);
  const typeField = valuesOf(summary, typeCandidate).length > 0 ? typeCandidate : NO_FIELD;

  return {
    idField: pick(summary.fields, FIELD_NAMES.idField),
    nameField: pick(summary.fields, FIELD_NAMES.nameField),
    descriptionField: pick(summary.fields, FIELD_NAMES.descriptionField),
    urlField: pick(summary.fields, FIELD_NAMES.urlField),
    typeField,
    fixedType: LEAVE_OUT,
    typeValues: guessTypeValues(valuesOf(summary, typeField)),
  };
}

// keep-comment: the source's last mapping where the file still has those fields; anything new is guessed
export function initialMapping(
  summary: FileSummary,
  saved: FacilityImportMappingResponse | null | undefined,
): MappingDraft {
  const guessed = guessMapping(summary);
  if (!saved) return guessed;

  const names = new Set(summary.fields.map((field) => field.name));
  const keep = (field: string | null | undefined, fallback: string) =>
    field ? (names.has(field) ? field : fallback) : NO_FIELD;
  const typeField = keep(saved.typeField, guessed.typeField);
  const known = Object.fromEntries(saved.typeValues.map((v) => [v.value, v.facilityType]));

  return {
    // keep-comment: never swapped for a guess; the server refuses another id field once the source has facilities
    idField: saved.idField ?? NO_FIELD,
    nameField: keep(saved.nameField, guessed.nameField),
    descriptionField: keep(saved.descriptionField, guessed.descriptionField),
    urlField: keep(saved.urlField, guessed.urlField),
    typeField,
    fixedType: saved.fixedType,
    typeValues: guessTypeValues(valuesOf(summary, typeField), known),
  };
}

export function mappingProblem(draft: MappingDraft, summary: FileSummary): string | null {
  if (draft.idField !== NO_FIELD && !summary.fields.some((field) => field.name === draft.idField)) {
    return `The file has no ${draft.idField}, which this data source's facilities are matched by.`;
  }
  if (draft.nameField === NO_FIELD) return "Choose the field that holds the name.";
  if (draft.typeField === NO_FIELD && draft.fixedType === LEAVE_OUT) return "Choose a facility type for the file.";
  if (draft.typeField !== NO_FIELD && Object.values(draft.typeValues).every((type) => type === LEAVE_OUT)) {
    return "Give at least one value a facility type.";
  }
  return null;
}

export function toRequest(draft: MappingDraft): FacilityImportMappingRequest {
  const field = (name: string) => (name === NO_FIELD ? null : name);

  return {
    idField: field(draft.idField),
    nameField: draft.nameField,
    descriptionField: field(draft.descriptionField),
    urlField: field(draft.urlField),
    typeField: field(draft.typeField),
    fixedType: draft.typeField === NO_FIELD ? draft.fixedType : LEAVE_OUT,
    typeValues:
      draft.typeField === NO_FIELD
        ? []
        : Object.entries(draft.typeValues).map(([value, facilityType]) => ({ value, facilityType })),
  };
}
