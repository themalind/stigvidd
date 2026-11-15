// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useReducer } from "react";
import {
  useApplyImport,
  usePreviewImport,
  type Choices,
  type ImportRow,
} from "@/features/facility-import/api/facility-import";
import { useImportSources } from "@/features/facility-import/api/sources";
import { choicesOf } from "@/features/facility-import/utils/facility-import";
import {
  initialWizard,
  readGeoJsonFile,
  wizardReducer,
  type Shown,
  type Step,
} from "@/features/facility-import/utils/import-wizard";
import { initialMapping, toRequest, type MappingDraft } from "@/features/facility-import/utils/mapping";

const NO_CHOICES: Choices = { links: [], kept: [] };

export function useImportWizard() {
  const sources = useImportSources();
  const [state, dispatch] = useReducer(wizardReducer, initialWizard);
  const load = usePreviewImport();
  // keep-comment: a second mutation so re-planning after a choice leaves the earlier steps and the rows alone
  const replan = usePreviewImport();
  const apply = useApplyImport();

  const source = sources.data?.find((s) => s.identifier === state.sourceIdentifier);
  const read = state.read?.file === state.file ? state.read : null;
  const summary = read?.inspection.ok ? read.inspection.summary : null;
  const draft = summary ? (state.edited ?? initialMapping(summary, source?.mapping)) : null;

  async function chooseFile(file: File | null) {
    dispatch({ type: "file", file });
    if (file) dispatch({ type: "read", read: await readGeoJsonFile(file) });
  }

  function compare() {
    if (!read || !draft) return;
    const file = { sourceIdentifier: state.sourceIdentifier, geoJson: read.geoJson, mapping: toRequest(draft) };
    load.mutate(
      { ...file, ...NO_CHOICES },
      { onSuccess: (preview) => dispatch({ type: "compared", shown: { file, preview } }) },
    );
  }

  // keep-comment: the choice shows at once, then the server's plan for it replaces the rows
  function choose(shown: Shown, rows: ImportRow[]) {
    dispatch({ type: "show", shown: { ...shown, preview: { ...shown.preview, rows } } });
    replan.mutate(
      { ...shown.file, ...choicesOf(rows) },
      {
        onSuccess: (preview) => dispatch({ type: "planned", shown: { file: shown.file, preview } }),
        onError: () => dispatch({ type: "planned", shown }),
      },
    );
  }

  function save({ file, preview }: Shown) {
    apply.mutate(
      { ...file, ...choicesOf(preview.rows) },
      { onSuccess: (result) => dispatch({ type: "applied", result }) },
    );
  }

  return {
    state,
    source,
    read,
    summary,
    draft,
    comparing: load.isPending,
    replanning: replan.isPending,
    applying: apply.isPending,
    chooseMunicipality: (identifier: string) => dispatch({ type: "municipality", identifier }),
    chooseSource: (identifier: string) => dispatch({ type: "source", identifier }),
    chooseFile,
    editMapping: (next: MappingDraft) => dispatch({ type: "mapping", draft: next }),
    goTo: (step: Step) => dispatch({ type: "go", step }),
    compare,
    choose,
    save,
    importAnother: () => dispatch({ type: "another" }),
  };
}
