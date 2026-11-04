// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PROPOSALS_PAGE_SIZE,
  proposalsQueryOptions,
  type ProposalFilters,
} from "@/features/trail-import/api/trail-import";
import { toggleProposal, type CheckedProposals } from "@/features/trail-import/utils/trail-import-review";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import { ProposalDetail } from "./proposal-detail";
import { ProposalRow } from "./proposal-row";
import type { RelinkTarget } from "./relink-picker";
import { SelectionBar } from "./selection-bar";

interface Props {
  sessionId: number;
  filters: ProposalFilters;
  page: number;
  applied: boolean;
  trails: RelinkTarget[] | undefined;
  narrowedBy: string[];
  onPageChange: (page: number) => void;
  onShowAll: () => void;
}

function emptyText(narrowedBy: string[]): string {
  if (narrowedBy.length === 2) return `No proposal is both ${narrowedBy[0]} and ${narrowedBy[1]}.`;
  if (narrowedBy.length === 1) return `No proposal is ${narrowedBy[0]}.`;
  return "This session has no proposals.";
}

const Key = ({ children }: { children: string }) => <kbd className="rounded border px-1">{children}</kbd>;

export function ProposalQueue({
  sessionId,
  filters,
  page,
  applied,
  trails,
  narrowedBy,
  onPageChange,
  onShowAll,
}: Props) {
  const { data } = useSuspenseQuery(proposalsQueryOptions(sessionId, filters, page));
  const proposals = data.items;
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState<CheckedProposals>(new Map());
  // keep-comment: falls back to the first row as the list changes, so the keyboard never lands on nothing
  const selected = proposals.find((p) => p.id === picked) ?? proposals[0] ?? null;

  const step = (offset: number) => {
    if (proposals.length === 0) return;
    const index = proposals.findIndex((p) => p.id === selected?.id);
    setPicked(proposals[Math.min(Math.max(index + offset, 0), proposals.length - 1)].id);
  };

  useKeyboardShortcuts({ j: () => step(1), k: () => step(-1) });

  const first = (page - 1) * PROPOSALS_PAGE_SIZE + 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="space-y-1">
        {proposals.length === 0 && (
          <div className="space-y-3 rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">{emptyText(narrowedBy)}</p>
            {narrowedBy.length > 0 && (
              <Button variant="outline" size="sm" onClick={onShowAll}>
                Show all
              </Button>
            )}
          </div>
        )}

        {!applied && proposals.length > 0 && (
          <SelectionBar
            sessionId={sessionId}
            filters={filters}
            proposals={proposals}
            total={data.totalCount}
            checked={checked}
            onCheckedChange={setChecked}
          />
        )}

        <div className="max-h-[70vh] divide-y overflow-y-auto rounded-md border">
          {proposals.map((proposal) => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              selected={proposal.id === selected?.id}
              checked={applied ? undefined : checked.has(proposal.id)}
              onCheck={() => setChecked((current) => toggleProposal(current, proposal))}
              onSelect={() => setPicked(proposal.id)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <span>
            {data.totalCount === 0 ? "0" : `${first}–${first + proposals.length - 1}`} of {data.totalCount}
          </span>
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Next page"
              disabled={!data.hasMore}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight />
            </Button>
          </span>
        </div>

        {!applied && (
          <p className="pt-2 text-xs text-muted-foreground">
            <Key>j</Key>/<Key>k</Key> step · <Key>a</Key> accept · <Key>r</Key> relink · <Key>n</Key> new · <Key>x</Key>{" "}
            exclude · <Key>s</Key> skip · <Key>u</Key> undo
          </p>
        )}
      </div>

      <div className="rounded-md border p-4">
        {selected ? (
          <ProposalDetail
            key={selected.id}
            sessionId={sessionId}
            proposal={selected}
            trails={trails}
            readOnly={applied}
            onDecided={() => step(1)}
          />
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">Pick a feature to review it.</p>
        )}
      </div>
    </div>
  );
}
