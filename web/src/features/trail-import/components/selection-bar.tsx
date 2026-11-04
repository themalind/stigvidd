// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  fetchProposalPage,
  useDecideBulk,
  type Proposal,
  type ProposalFilters,
} from "@/features/trail-import/api/trail-import";
import {
  canBulkDecide,
  canSelectAllMatching,
  collectAllMatching,
  pageSelection,
  togglePageSelection,
  type CheckedProposals,
} from "@/features/trail-import/utils/trail-import-review";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// keep-comment: far above the largest export so far (203 features); it only stops a server that always says there is more
const MAX_SELECT_ALL_PAGES = 50;

interface Props {
  sessionId: number;
  filters: ProposalFilters;
  proposals: Proposal[];
  total: number;
  checked: CheckedProposals;
  onCheckedChange: (checked: CheckedProposals) => void;
}

export function SelectionBar({ sessionId, filters, proposals, total, checked, onCheckedChange }: Props) {
  const [selectingAll, setSelectingAll] = useState(false);
  const bulk = useDecideBulk(sessionId);
  const selection = pageSelection(checked, proposals);
  const bulkable = canBulkDecide(checked);

  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const outcome = await collectAllMatching(
        (page) => fetchProposalPage(sessionId, filters, page),
        MAX_SELECT_ALL_PAGES,
      );

      if (!outcome.complete) {
        toast.error(
          `Stopped after ${outcome.pagesWalked} pages, so the selection is incomplete ` +
            "and has been left alone. Narrow the filter and try again.",
        );
        return;
      }

      onCheckedChange(outcome.checked);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The selection could not be built.");
    } finally {
      setSelectingAll(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
      <Checkbox
        checked={selection.whole ? true : selection.onPage > 0 ? "indeterminate" : false}
        onCheckedChange={() => onCheckedChange(togglePageSelection(checked, proposals))}
        aria-label="Select every proposal on this page"
      />
      <span className="text-xs text-muted-foreground">
        {checked.size > 0 ? `${checked.size} selected` : `Select all ${proposals.length} on this page`}
      </span>

      {canSelectAllMatching(selection, total, checked) && (
        <Button
          size="sm"
          variant="link"
          className="h-auto p-0 text-xs"
          disabled={selectingAll}
          onClick={() => void selectAllMatching()}
        >
          {selectingAll ? <Loader2 className="animate-spin" /> : null}
          Select all {total} matching
        </Button>
      )}

      {checked.size > 0 && (
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            disabled={!bulkable || bulk.isPending}
            title={
              bulkable
                ? "Accept every selected suggestion"
                : "Batch accept is only for Certain and High — the rest need looking at"
            }
            onClick={() =>
              bulk.mutate(
                { proposalIds: [...checked.keys()], decision: "Accept" },
                { onSuccess: () => onCheckedChange(new Map()) },
              )
            }
          >
            {bulk.isPending ? <Loader2 className="animate-spin" /> : null}
            Accept selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onCheckedChange(new Map())}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
