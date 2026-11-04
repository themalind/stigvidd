// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { PageSelection } from "@/features/media/utils/media-browse";

interface Props {
  selection: PageSelection;
  selectedCount: number;
  selectableCount: number;
  reprocessable: number;
  allMatching: boolean;
  offerAllMatching: boolean;
  onTogglePage: () => void;
  onAllMatchingChange: (allMatching: boolean) => void;
  onOptimize: () => void;
}

export function MediaSelectionBar({
  selection,
  selectedCount,
  selectableCount,
  reprocessable,
  allMatching,
  offerAllMatching,
  onTogglePage,
  onAllMatchingChange,
  onOptimize,
}: Props) {
  return (
    <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-xs border px-2 py-1.5">
      {allMatching ? (
        <>
          <span className="text-sm">All {reprocessable} image(s) matching this filter are selected.</span>
          <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => onAllMatchingChange(false)}>
            Select just this page instead
          </Button>
        </>
      ) : (
        <>
          <Checkbox
            checked={selection.whole ? true : selection.onPage > 0 ? "indeterminate" : false}
            onCheckedChange={onTogglePage}
            disabled={selectableCount === 0}
            aria-label="Select every image on this page"
          />
          <span className="text-muted-foreground text-xs">
            {selectedCount > 0 ? `${selectedCount} selected` : `Select all ${selectableCount} on this page`}
          </span>
          {offerAllMatching && (
            <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => onAllMatchingChange(true)}>
              Select all {reprocessable} matching this filter
            </Button>
          )}
        </>
      )}

      <Button
        size="sm"
        className="ml-auto"
        disabled={allMatching ? reprocessable === 0 : selectedCount === 0}
        onClick={onOptimize}
      >
        Optimize {allMatching ? reprocessable : selectedCount || ""}
      </Button>
    </div>
  );
}
