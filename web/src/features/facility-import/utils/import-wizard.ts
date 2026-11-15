// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ApplyResult, Preview, SourceFile } from "@/features/facility-import/api/facility-import";
import { inspectGeoJson, type Inspection } from "./inspect";
import type { MappingDraft } from "./mapping";

export const STEPS = ["Source", "File", "Fields", "Review", "Done"] as const;
export type Step = (typeof STEPS)[number];

export function stepIndex(step: Step): number {
  return STEPS.indexOf(step);
}

export interface ReadFile {
  file: File;
  geoJson: string;
  inspection: Inspection;
}

export async function readGeoJsonFile(file: File): Promise<ReadFile> {
  try {
    const geoJson = await file.text();
    return { file, geoJson, inspection: inspectGeoJson(geoJson) };
  } catch {
    return { file, geoJson: "", inspection: { ok: false, error: "The file could not be read." } };
  }
}

export interface Shown {
  file: SourceFile;
  preview: Preview;
}

export interface WizardState {
  step: Step;
  municipalityIdentifier: string;
  sourceIdentifier: string;
  file: File | null;
  read: ReadFile | null;
  // keep-comment: null until edited; until then the mapping follows the file and the data source's last one
  edited: MappingDraft | null;
  // keep-comment: kept apart from the mutation's data, which empties while the next preview is pending
  shown: Shown | null;
  result: ApplyResult | null;
}

export type WizardAction =
  | { type: "municipality"; identifier: string }
  | { type: "source"; identifier: string }
  | { type: "file"; file: File | null }
  | { type: "read"; read: ReadFile }
  | { type: "mapping"; draft: MappingDraft }
  | { type: "go"; step: Step }
  | { type: "compared"; shown: Shown }
  | { type: "show"; shown: Shown }
  | { type: "planned"; shown: Shown }
  | { type: "applied"; result: ApplyResult }
  | { type: "another" };

export const initialWizard: WizardState = {
  step: "Source",
  municipalityIdentifier: "",
  sourceIdentifier: "",
  file: null,
  read: null,
  edited: null,
  shown: null,
  result: null,
};

// keep-comment: a new source or file makes the mapping and the shown comparison stale
const fresh = { edited: null, shown: null } as const;

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "municipality":
      return { ...state, ...fresh, municipalityIdentifier: action.identifier, sourceIdentifier: "" };
    case "source":
      return { ...state, ...fresh, sourceIdentifier: action.identifier };
    case "file":
      return { ...state, ...fresh, file: action.file };
    case "read":
      // keep-comment: a slow read of a file that was since replaced must not take the newer file's place
      return action.read.file === state.file ? { ...state, read: action.read } : state;
    case "mapping":
      return { ...state, edited: action.draft, shown: null };
    case "go":
      return { ...state, step: action.step };
    case "compared":
      return { ...state, shown: action.shown, step: "Review" };
    case "show":
      return { ...state, shown: action.shown };
    case "planned":
      // keep-comment: only for the file that is still shown; a reply after another file was chosen is dropped
      return state.shown?.file === action.shown.file ? { ...state, shown: action.shown } : state;
    case "applied":
      return { ...state, result: action.result, step: "Done" };
    case "another":
      return { ...state, ...fresh, file: null, read: null, result: null, step: "File" };
  }
}
