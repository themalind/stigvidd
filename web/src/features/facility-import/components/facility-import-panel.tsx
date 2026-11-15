// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StepList, StepSummary } from "@/components/step-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useImportWizard } from "@/features/facility-import/hooks/use-import-wizard";
import { markChoice, markKept } from "@/features/facility-import/utils/facility-import";
import { STEPS, stepIndex, type Step } from "@/features/facility-import/utils/import-wizard";
import { NO_FIELD, type MappingDraft } from "@/features/facility-import/utils/mapping";
import { facilityTypeLabel } from "@/utils/facility-types";
import { FieldsStep } from "./fields-step";
import { FileStep } from "./file-step";
import { ImportDone } from "./import-done";
import { ImportReview } from "./import-review";
import { SourceStep } from "./source-step";

function fieldsText(draft: MappingDraft): string {
  const id = draft.idField === NO_FIELD ? "places by position" : `id from ${draft.idField}`;
  const kind =
    draft.typeField === NO_FIELD ? `all ${facilityTypeLabel(draft.fixedType)}` : `kind from ${draft.typeField}`;
  return `Name from ${draft.nameField} · ${id} · ${kind}`;
}

export function FacilityImportPanel() {
  const wizard = useImportWizard();
  const { state, source, read, summary, draft } = wizard;
  const { step, file, shown, result } = state;
  const at = stepIndex(step);
  const busy = wizard.comparing || wizard.applying;
  const goTo = (target: Step) => () => wizard.goTo(target);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facility import</CardTitle>
        <CardDescription>
          Bring in places from a municipality&apos;s open data, such as catalog.boras.se. Nothing is saved until the
          last step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <StepList label="Import steps" steps={STEPS} current={at} />

        {step !== "Source" && step !== "Done" && (
          <div className="space-y-2">
            <StepSummary label="Source" disabled={busy} onChange={goTo("Source")}>
              {source ? `${source.municipalityName} · ${source.name}` : ""}
            </StepSummary>
            {at > stepIndex("File") && file && (
              <StepSummary label="File" disabled={busy} onChange={goTo("File")}>
                {file.name}
                {summary ? ` · ${summary.points} ${summary.points === 1 ? "point" : "points"}` : ""}
              </StepSummary>
            )}
            {at > stepIndex("Fields") && draft && (
              <StepSummary label="Fields" disabled={busy} onChange={goTo("Fields")}>
                {fieldsText(draft)}
              </StepSummary>
            )}
          </div>
        )}

        {step === "Source" && (
          <SourceStep
            municipalityIdentifier={state.municipalityIdentifier}
            sourceIdentifier={state.sourceIdentifier}
            onMunicipality={wizard.chooseMunicipality}
            onSource={wizard.chooseSource}
            onContinue={goTo("File")}
          />
        )}

        {step === "File" && (
          <FileStep
            file={file}
            inspection={read?.inspection ?? null}
            onFile={(chosen) => void wizard.chooseFile(chosen)}
            onContinue={goTo("Fields")}
          />
        )}

        {step === "Fields" && summary && draft && (
          <FieldsStep
            summary={summary}
            draft={draft}
            remembered={Boolean(source?.mapping)}
            busy={wizard.comparing}
            onChange={wizard.editMapping}
            onCompare={wizard.compare}
          />
        )}

        {step === "Review" && shown && (
          <ImportReview
            preview={shown.preview}
            locked={busy}
            busy={busy || wizard.replanning}
            applying={wizard.applying}
            onChoose={(sourceId, choice) => wizard.choose(shown, markChoice(shown.preview.rows, sourceId, choice))}
            onKeep={(sourceId, field, keep) =>
              wizard.choose(shown, markKept(shown.preview.rows, sourceId, field, keep))
            }
            onApply={() => wizard.save(shown)}
          />
        )}

        {step === "Done" && result && shown && (
          <ImportDone
            result={result}
            sourceKey={shown.preview.source}
            sourceName={source ? `${source.name} in ${source.municipalityName}` : shown.preview.source}
            onAnother={wizard.importAnother}
          />
        )}
      </CardContent>
    </Card>
  );
}
