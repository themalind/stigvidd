// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { FacilityImportField } from "@/api/generated/model";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ImportRow as Row, Preview } from "@/features/facility-import/api/facility-import";
import { groupRows, outcomeOf, outcomeText, takenElsewhere } from "@/features/facility-import/utils/facility-import";
import { ImportRow } from "./import-row";

function Figure({ value, label, warn = false }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-sm border p-3", warn && value > 0 && "border-amber-500/60")}>
      <div className={cn("text-2xl font-semibold tabular-nums", warn && value > 0 && "text-amber-600")}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Group({
  title,
  hint,
  warn = false,
  children,
}: {
  title: string;
  hint: string;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className={cn("text-sm font-semibold", warn && "text-amber-600")}>{title}</h3>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

interface Props {
  preview: Preview;
  // keep-comment: locked stops the rows from changing; busy only holds back saving until the plan matches the rows
  locked: boolean;
  busy: boolean;
  applying: boolean;
  onChoose: (sourceId: string, choice: string) => void;
  onKeep: (sourceId: string, field: FacilityImportField, keep: boolean) => void;
  onApply: () => void;
}

export function ImportReview({ preview, locked, busy, applying, onChoose, onKeep, onApply }: Props) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const groups = groupRows(preview.rows);
  const outcome = outcomeOf(preview.rows);

  function rowOf(row: Row) {
    return (
      <ImportRow
        key={row.sourceId}
        row={row}
        candidates={preview.unlinkedFacilities}
        taken={takenElsewhere(preview.rows, row.sourceId)}
        disabled={locked}
        onChoose={(choice) => onChoose(row.sourceId, choice)}
        onKeep={(field, keep) => onKeep(row.sourceId, field, keep)}
      />
    );
  }

  async function handleApply() {
    const anyRowChanges = outcome.created + outcome.linked + outcome.changed > 0;
    const ok = await confirm({
      title: "Save the import?",
      description: anyRowChanges
        ? outcomeText(outcome)
        : "Nothing you can see changes. The file's values are saved as the baseline the next import compares against.",
      confirmLabel: "Save",
    });

    if (ok) onApply();
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Check before saving</h2>
        <p className="text-sm text-muted-foreground">
          {preview.rows.length} {preview.rows.length === 1 ? "place" : "places"}, compared with the facilities Stigvidd
          already has. Nothing is saved until you save.
        </p>
      </div>

      {!preview.hasWork && (
        <p role="status" className="rounded-sm border border-emerald-600/40 bg-emerald-600/10 p-3 text-sm">
          Already imported: every place in this file matches what Stigvidd has, so there is nothing to save. Import the
          next export of the file when the municipality updates it.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Figure value={groups.twins.length} label="might already exist" warn />
        <Figure value={outcome.created} label="new" />
        <Figure value={outcome.linked} label="linked" />
        <Figure value={outcome.changed} label="changed" />
        <Figure value={outcome.missing} label="no longer in the file" />
      </div>

      {preview.notes.length > 0 && (
        <div className="rounded-sm border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950">
          <p className="mb-1 font-medium">Adjusted to fit</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {preview.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {groups.twins.length > 0 && (
        <Group
          title="Might already exist: decide for each"
          hint="These look like a facility we already have. Linking gives ours the file's position and text, and later imports keep it up to date. Tick Keep to hold on to a value of ours."
          warn
        >
          {groups.twins.map(rowOf)}
        </Group>
      )}

      {groups.fresh.length > 0 && (
        <Group
          title="New places"
          hint="Each becomes a new facility. If we already have one under another name, link it here."
        >
          {groups.fresh.map(rowOf)}
        </Group>
      )}

      {groups.changed.length > 0 && (
        <Group
          title="Changed since the last import"
          hint="A value the file changed is taken, even over an edit made here, unless you keep ours."
        >
          {groups.changed.map(rowOf)}
        </Group>
      )}

      {groups.missing.length > 0 && (
        <Group title="No longer in the file" hint="Nothing is removed. Delete one in Facilities if it is really gone.">
          {groups.missing.map(rowOf)}
        </Group>
      )}

      {groups.unchanged.length > 0 && (
        <div className="space-y-2">
          <Button size="sm" variant="ghost" onClick={() => setShowUnchanged(!showUnchanged)}>
            {showUnchanged ? "Hide unchanged" : `Show ${groups.unchanged.length} unchanged`}
          </Button>
          {showUnchanged && <ul className="space-y-2">{groups.unchanged.map(rowOf)}</ul>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button disabled={!preview.hasWork || busy} onClick={() => void handleApply()}>
          {applying ? <Loader2 className="animate-spin" /> : null}
          Save import
        </Button>
        <span className="text-xs text-muted-foreground">
          {preview.hasWork
            ? `${outcome.created} new · ${outcome.linked} linked · ${outcome.changed} changed · nothing deleted`
            : "Everything is up to date."}
        </span>
      </div>

      {confirmDialog}
    </section>
  );
}
