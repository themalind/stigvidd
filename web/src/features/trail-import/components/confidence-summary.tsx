// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { confidenceOrder, type Confidence, type Session } from "@/features/trail-import/api/trail-import";
import { countFor } from "@/features/trail-import/utils/trail-import-review";
import { ConfidenceBadge } from "./badges";

const tiers = [...confidenceOrder].reverse();

interface Props {
  counts: Session["counts"];
  selected: Confidence | undefined;
  onSelect: (confidence: Confidence | undefined) => void;
}

export function ConfidenceSummary({ counts, selected, onSelect }: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiers.map((tier) => (
          <button
            key={tier}
            type="button"
            aria-pressed={selected === tier}
            onClick={() => onSelect(selected === tier ? undefined : tier)}
            className={`rounded-md border p-3 text-left transition-colors hover:bg-accent ${
              selected === tier ? "border-primary bg-accent" : ""
            }`}
          >
            <p className="text-2xl font-semibold tabular-nums">{countFor(counts, tier)}</p>
            <ConfidenceBadge confidence={tier} />
          </button>
        ))}
      </div>

      {counts && (
        <p className="text-xs text-muted-foreground">
          {counts.pending} undecided · {counts.accepted} accepted · {counts.relinked} relinked · {counts.createNew} new
          · {counts.excluded} excluded · {counts.skipped} skipped
        </p>
      )}
    </>
  );
}
