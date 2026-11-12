// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useApplyImport,
  usePreviewImport,
  type Choices,
  type ImportRow,
  type Preview,
  type SourceFile,
} from "@/features/facility-import/api/facility-import";
import { choicesOf, markChoice, markKept } from "@/features/facility-import/utils/facility-import";
import { ImportReview } from "./import-review";
import { SourceForm } from "./source-form";

interface Shown {
  file: SourceFile;
  preview: Preview;
}

const NO_CHOICES: Choices = { links: [], kept: [] };

export function FacilityImportPanel() {
  // keep-comment: kept apart from the mutation's data, which empties while the next preview is pending
  const [shown, setShown] = useState<Shown | null>(null);
  const load = usePreviewImport();
  // keep-comment: a second mutation so re-planning after a choice leaves the file form and the rows alone
  const replan = usePreviewImport();
  const apply = useApplyImport();

  // keep-comment: only for the file that is still shown; a reply after another file was chosen is dropped
  function showFor(file: SourceFile, preview: Preview) {
    setShown((current) => (current?.file === file ? { file, preview } : current));
  }

  function runLoad(file: SourceFile) {
    load.mutate({ ...file, ...NO_CHOICES }, { onSuccess: (result) => setShown({ file, preview: result }) });
  }

  // keep-comment: the choice shows at once, then the server's plan for it replaces the rows
  function runReplan(current: Shown, rows: ImportRow[]) {
    setShown({ ...current, preview: { ...current.preview, rows } });
    replan.mutate(
      { ...current.file, ...choicesOf(rows) },
      { onSuccess: (result) => showFor(current.file, result), onError: () => showFor(current.file, current.preview) },
    );
  }

  function runApply({ file, preview: current }: Shown) {
    apply.mutate(
      { ...file, ...choicesOf(current.rows) },
      { onSuccess: () => replan.mutate({ ...file, ...NO_CHOICES }, { onSuccess: (result) => showFor(file, result) }) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facility import</CardTitle>
        <CardDescription>
          A GeoJSON file of facilities from a municipality&apos;s open data, such as catalog.boras.se. Choose which
          fields hold the name, id and type. A field the file changed since the last import is taken, even over an edit
          made here, unless you keep ours; everything else stays as it is.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SourceForm
          busy={load.isPending || apply.isPending}
          onPreview={(file) => runLoad(file)}
          onChange={() => setShown(null)}
        />

        {shown && (
          <ImportReview
            preview={shown.preview}
            locked={load.isPending || apply.isPending}
            busy={load.isPending || replan.isPending || apply.isPending}
            applying={apply.isPending}
            onChoose={(sourceId, choice) => runReplan(shown, markChoice(shown.preview.rows, sourceId, choice))}
            onKeep={(sourceId, field, keep) => runReplan(shown, markKept(shown.preview.rows, sourceId, field, keep))}
            onApply={() => runApply(shown)}
          />
        )}
      </CardContent>
    </Card>
  );
}
