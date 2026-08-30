// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { NavLink } from "react-router";
import { applySession, getDiff, type Diff, type Session } from "@/api/trail-import";
import { Button } from "@/components/ui/button";
import { decisionLabel } from "@/components/trail-import/badges";

type Props = {
  session: Session;
  /** Re-read after a successful apply: the session's status and counts both move. */
  onApplied: () => void;
  /** Narrows the list to the features that created a trail. */
  onShowCreated: () => void;
};

type Conflict = {
  trailId: number;
  trailName: string;
  field: string;
  ours: string;
  theirs: string;
};

function Figure({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-2xl font-semibold tabular-nums">{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Conflicts({ conflicts, lead }: { conflicts: Conflict[]; lead: string }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
      <p className="text-sm font-medium">
        {conflicts.length} {lead}
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.trailId}-${conflict.field}-${index}`}>
            <span className="font-medium text-foreground">{conflict.trailName}</span> ·{" "}
            {conflict.field}: kept “{conflict.ours}”, source said “{conflict.theirs}”
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What a run linked but did not change. A first sync has no stored snapshot to merge
 * against, so it may write no field on any existing trail — which makes a zero the
 * expected result rather than a sign that nothing happened.
 */
function LinkedWithoutChanges({
  updated,
  linked,
}: {
  updated: number | undefined;
  linked: number | undefined | null;
}) {
  if (!linked || (updated ?? 0) > 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {linked} existing trail(s) were linked without being changed. The source may only
      overwrite a field it has been recorded against before, so this run stores that
      baseline and the next one can merge against it.
    </p>
  );
}

/** The receipt for an applied session. Read from the session, so it survives a reload. */
function Applied({
  session,
  onShowCreated,
}: {
  session: Session;
  onShowCreated: () => void;
}) {
  const applied = session.applied;
  const created = applied?.trailsCreated ?? 0;

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-500" />
        <h2 className="text-sm font-semibold">Applied</h2>
        <span className="text-xs text-muted-foreground">
          {session.appliedAt ? new Date(session.appliedAt).toLocaleString() : "—"}
        </span>
      </div>

      {applied ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure value={applied.trailsCreated} label="trails created" />
            <Figure value={applied.trailsUpdated} label="trails updated" />
            <Figure value={applied.linksWritten} label="links written" />
            <Figure value={applied.featuresExcluded} label="features excluded" />
          </div>

          <LinkedWithoutChanges
            updated={applied.trailsUpdated}
            linked={applied.trailsLinked}
          />

          <Conflicts
            conflicts={applied.conflicts ?? []}
            lead="field(s) the source would have overwritten. Ours stands; these are worth a look."
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {created > 0 && (
              <Button size="sm" variant="outline" onClick={onShowCreated}>
                Show the {created} new trail(s)
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <NavLink to="/trail-import">
                <ArrowLeft />
                Back to sessions
              </NavLink>
            </Button>
          </div>

          {created > 0 && (
            <p className="text-xs text-muted-foreground">
              A new trail is created unverified, so the app does not list it until someone
              has looked at it.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This session was applied before the run was recorded, so there are no figures for
          it. Its links are on the trails all the same.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        The decisions below are history now — an applied session cannot be decided again.
      </p>
    </div>
  );
}

/**
 * Everything between a reviewed session and a written one. The apply button stays out of
 * reach until the diff has been read, because it is the only call in the sync that changes
 * Trails and there is no undo behind it.
 */
export function ApplyPanel({ session, onApplied, onShowCreated }: Props) {
  const sessionId = session.id;
  const [diff, setDiff] = useState<Diff | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      setDiff(await getDiff(sessionId));
    } catch {
      toast.error("The preview could not be read.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setDiff(null);
  }, [sessionId]);

  async function apply() {
    setApplying(true);

    try {
      const result = await applySession(sessionId);
      setDiff(null);
      toast.success(
        `Applied: ${result.trailsCreated} created, ${result.trailsUpdated} updated, ${result.linksWritten} links written.`,
      );
      onApplied();
    } catch {
      toast.error("The session could not be applied.");
    } finally {
      setApplying(false);
    }
  }

  if (session.status === "Applied")
    return <Applied session={session} onShowCreated={onShowCreated} />;

  if (!diff) {
    return (
      <div className="flex items-center gap-3 rounded-md border p-4">
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="animate-spin" /> : null}
          Review what applying would write
        </Button>
        <span className="text-xs text-muted-foreground">
          Nothing reaches Trails until this is applied.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">What applying would write</h2>
        <Button size="sm" variant="ghost" onClick={() => setDiff(null)}>
          Close
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={diff.trailsToCreate} label="trails created" />
        <Figure value={diff.trailsToUpdate} label="trails updated" />
        <Figure value={diff.linksToWrite} label="links written" />
        <Figure value={diff.featuresExcluded} label="features excluded" />
      </div>

      <LinkedWithoutChanges updated={diff.trailsToUpdate} linked={diff.trailsLinked} />

      <p className="text-xs text-muted-foreground">
        {diff.featuresPending} undecided and {diff.featuresSkipped} skipped are left where
        they are.
      </p>

      {diff.againstStrongMatch.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" />
            {diff.againstStrongMatch.length} decision(s) go against a strong match
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {diff.againstStrongMatch.map((warning) => (
              <li key={warning.proposalId}>
                <span className="font-medium text-foreground">{warning.featureName}</span>{" "}
                · {decisionLabel[warning.decision] ?? warning.decision} despite{" "}
                {warning.confidence} at {Math.round((warning.coverageForward ?? 0) * 100)} %
                {warning.trailName ? ` on ${warning.trailName}` : ""}
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
            Right when the route is curated and the source's line is broken; a mistake
            otherwise. Their geometry stays as it is either way.
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {diff.withoutSegment.map((trail) => (
              <li key={trail.trailId}>
                <span className="font-medium text-foreground">{trail.trailName}</span> ·{" "}
                {trail.duplicateLinks} duplicate link(s)
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.blockedReason && (
        <p className="text-sm text-muted-foreground">{diff.blockedReason}</p>
      )}

      <Button disabled={!diff.canApply || applying} onClick={() => void apply()}>
        {applying ? <Loader2 className="animate-spin" /> : null}
        Apply {diff.linksToWrite} decision(s)
      </Button>
    </div>
  );
}
