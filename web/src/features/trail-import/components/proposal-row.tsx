// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Proposal } from "@/features/trail-import/api/trail-import";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfidenceBadge, DecisionBadge } from "./badges";

interface Props {
  proposal: Proposal;
  selected: boolean;
  checked?: boolean;
  onCheck: () => void;
  onSelect: () => void;
}

// keep-comment: without a suggestion the coverage says nothing alone; the nearest trail is what it was measured against
function trailLine(proposal: Proposal): string {
  if (proposal.suggestedTrailName) return proposal.suggestedTrailName;
  return proposal.nearestTrailName ? `nearest: ${proposal.nearestTrailName}` : "no trail suggested";
}

export function ProposalRow({ proposal, selected, checked, onCheck, onSelect }: Props) {
  return (
    <div
      data-testid="proposal-row"
      aria-current={selected}
      className={`flex items-start gap-2 p-2 ${selected ? "bg-accent" : "hover:bg-accent/50"}`}
    >
      {checked !== undefined && (
        <Checkbox
          className="mt-1"
          checked={checked}
          onCheckedChange={onCheck}
          aria-label={`Select ${proposal.featureName}`}
        />
      )}
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <p className="truncate text-sm font-medium">{proposal.featureName || "(no name in source)"}</p>
        <p className="truncate text-xs text-muted-foreground">{trailLine(proposal)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <ConfidenceBadge confidence={proposal.confidence} />
          {proposal.decision !== "Pending" && <DecisionBadge decision={proposal.decision} />}
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(proposal.coverageForward * 100)}/{Math.round(proposal.coverageBackward * 100)}%
          </span>
        </div>
      </button>
    </div>
  );
}
