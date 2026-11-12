// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { FacilityImportField } from "@/api/generated/model";
import { useConfirm } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { Preview } from "@/features/facility-import/api/facility-import";
import { countByKind, isLink, sortRows, takenElsewhere } from "@/features/facility-import/utils/facility-import";
import { ImportRow } from "./import-row";

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

interface Props {
  preview: Preview;
  // keep-comment: locked stops the rows from changing; busy only holds back Apply until the plan matches the rows
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

  const rows = sortRows(preview.rows);
  const counts = countByKind(rows);
  const linked = rows.filter(isLink).length;
  const visible = showUnchanged ? rows : rows.filter((row) => row.kind !== "Unchanged");

  async function handleApply() {
    const anyRowChanges = counts.New + counts.Changed > 0;
    const ok = await confirm({
      title: "Apply the import?",
      description: anyRowChanges
        ? `${counts.New - linked} created, ${linked} linked to an existing facility, ${counts.Changed} updated.\nNothing is deleted.`
        : "Nothing you can see changes. The file's values are saved as the baseline the next import compares against.",
      confirmLabel: "Apply",
    });

    if (ok) onApply();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Figure value={counts.New - linked} label="new" />
        <Figure value={linked} label="linked" />
        <Figure value={counts.Changed} label="changed" />
        <Figure value={counts.Missing} label="gone from source" />
        <Figure value={counts.Unchanged} label="unchanged" />
      </div>

      {preview.notes.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950">
          <p className="mb-1 font-medium">Adjusted to fit</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {preview.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((row) => (
          <ImportRow
            key={row.sourceId}
            row={row}
            candidates={preview.unlinkedFacilities}
            taken={takenElsewhere(rows, row.sourceId)}
            disabled={locked}
            onChoose={(choice) => onChoose(row.sourceId, choice)}
            onKeep={(field, keep) => onKeep(row.sourceId, field, keep)}
          />
        ))}
      </ul>

      {counts.Unchanged > 0 && (
        <Button size="sm" variant="ghost" onClick={() => setShowUnchanged(!showUnchanged)}>
          {showUnchanged ? "Hide unchanged" : `Show ${counts.Unchanged} unchanged`}
        </Button>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button disabled={!preview.hasWork || busy} onClick={() => void handleApply()}>
          {applying ? <Loader2 className="animate-spin" /> : null}
          Apply import
        </Button>
        {!preview.hasWork && <span className="text-xs text-muted-foreground">Everything is up to date.</span>}
      </div>

      {confirmDialog}
    </div>
  );
}
