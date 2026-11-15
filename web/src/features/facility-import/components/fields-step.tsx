// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileSummary } from "@/features/facility-import/utils/inspect";
import { exampleRows, mappingProblem, type MappingDraft } from "@/features/facility-import/utils/mapping";
import { MappingForm } from "./mapping-form";

interface Props {
  summary: FileSummary;
  draft: MappingDraft;
  remembered: boolean;
  busy: boolean;
  onChange: (draft: MappingDraft) => void;
  onCompare: () => void;
}

export function FieldsStep({ summary, draft, remembered, busy, onChange, onCompare }: Props) {
  const problem = mappingProblem(draft, summary);
  const examples = exampleRows(summary, draft);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Which columns hold what?</h2>
        <p className="text-sm text-muted-foreground">
          The table at the bottom shows how the first places will look in Stigvidd.
        </p>
      </div>

      <MappingForm summary={summary} draft={draft} remembered={remembered} disabled={busy} onChange={onChange} />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">How the first places will look</h3>
        <div className="overflow-x-auto rounded-sm border">
          <table className="w-full text-sm" aria-label="How the first places will look">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Source id</th>
                <th className="px-3 py-2 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {examples.map((row, index) => (
                <tr key={index} className="border-t">
                  <td className="px-3 py-2">{row.name || <span className="text-muted-foreground">(no name)</span>}</td>
                  <td className="px-3 py-2">{row.kind}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.id || "by position"}</td>
                  <td className="max-w-64 truncate px-3 py-2 text-muted-foreground">{row.link}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={problem !== null || busy} onClick={onCompare}>
          {busy ? <Loader2 className="animate-spin" /> : <FileSearch />}
          Compare with what we have
        </Button>
        {problem && <span className="text-xs text-muted-foreground">{problem}</span>}
      </div>
    </section>
  );
}
