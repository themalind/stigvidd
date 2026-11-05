// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useApplySession, useDiff, type Diff, type Session } from "@/features/trail-import/api/trail-import";
import { Button } from "@/components/ui/button";
import { AppliedReceipt, Figure, LinkedWithoutChanges } from "./applied-receipt";
import { decisionLabel } from "./badges";

interface Props {
  session: Session;
  onApplied: () => void;
  /** Narrows the list to the features that created a trail. */
  onShowCreated: () => void;
}

function Warnings({ diff }: { diff: Diff }) {
  return (
    <>
      {diff.againstStrongMatch.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" />
            {diff.againstStrongMatch.length} decision(s) go against a strong match
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {diff.againstStrongMatch.map((warning) => (
              <li key={warning.proposalId}>
                <span className="font-medium text-foreground">{warning.featureName}</span> ·{" "}
                {decisionLabel[warning.decision] ?? warning.decision} despite {warning.confidence} at{" "}
                {Math.round(warning.coverageForward * 100)} %{warning.trailName ? ` on ${warning.trailName}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.withoutSegment.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" />
            {diff.withoutSegment.length} trail(s) would be left with no segment
          </p>
          <p className="text-xs text-muted-foreground">
            Right when the route is curated and the source's line is broken; a mistake otherwise. Their geometry stays
            as it is either way.
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {diff.withoutSegment.map((trail) => (
              <li key={trail.trailId}>
                <span className="font-medium text-foreground">{trail.trailName}</span> · {trail.duplicateLinks}{" "}
                duplicate link(s)
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * Everything between a reviewed session and a written one. The apply button stays out of
 * reach until the diff has been read, because it is the only call in the sync that changes
 * Trails and there is no undo behind it.
 */
export function ApplyPanel({ session, onApplied, onShowCreated }: Props) {
  const [open, setOpen] = useState(false);
  const diff = useDiff(session.id, open);
  const apply = useApplySession(session.id);

  if (session.status === "Applied") return <AppliedReceipt session={session} onShowCreated={onShowCreated} />;

  if (!open || !diff.data) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-4">
        <Button
          size="sm"
          variant="outline"
          disabled={open && diff.isFetching}
          onClick={() => (open ? void diff.refetch() : setOpen(true))}
        >
          {open && diff.isFetching ? <Loader2 className="animate-spin" /> : null}
          Review what applying would write
        </Button>
        {open && diff.isError ? (
          <span role="alert" className="text-xs text-destructive">
            The preview could not be read.{diff.error instanceof Error ? ` ${diff.error.message}` : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Nothing reaches Trails until this is applied.</span>
        )}
      </div>
    );
  }

  const { data } = diff;

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">What applying would write</h2>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={data.trailsToCreate} label="trails created" />
        <Figure value={data.trailsToUpdate} label="trails updated" />
        <Figure value={data.linksToWrite} label="links written" />
        <Figure value={data.featuresExcluded} label="features excluded" />
      </div>

      <LinkedWithoutChanges updated={data.trailsToUpdate} linked={data.trailsLinked} />

      <p className="text-xs text-muted-foreground">
        {data.featuresPending} undecided and {data.featuresSkipped} skipped are left where they are.
      </p>

      <Warnings diff={data} />

      {data.blockedReason && <p className="text-sm text-muted-foreground">{data.blockedReason}</p>}

      <Button
        disabled={!data.canApply || apply.isPending}
        onClick={() =>
          apply.mutate(undefined, {
            onSuccess: () => {
              setOpen(false);
              onApplied();
            },
          })
        }
      >
        {apply.isPending ? <Loader2 className="animate-spin" /> : null}
        Apply {data.linksToWrite} decision(s)
      </Button>
    </div>
  );
}
