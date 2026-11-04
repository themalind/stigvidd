// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { NavLink } from "react-router";
import type { ApplyResult, Session } from "@/features/trail-import/api/trail-import";
import { Button } from "@/components/ui/button";
import { paths } from "@/config/paths";
import { formatDateTime } from "@/utils/format";

export function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// keep-comment: a first sync has no stored snapshot to merge against, so a zero here is the expected result
export function LinkedWithoutChanges({ updated, linked }: { updated: number; linked: number | null }) {
  if (!linked || updated > 0) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {linked} existing trail(s) were linked without being changed. The source may only overwrite a field it has been
      recorded against before, so this run stores that baseline and the next one can merge against it.
    </p>
  );
}

function Conflicts({ conflicts }: { conflicts: ApplyResult["conflicts"] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
      <p className="text-sm font-medium">
        {conflicts.length} field(s) the source would have overwritten. Ours stands; these are worth a look.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.trailId}-${conflict.field}-${index}`}>
            <span className="font-medium text-foreground">{conflict.trailName}</span> · {conflict.field}: kept “
            {conflict.ours}”, source said “{conflict.theirs}”
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppliedReceipt({ session, onShowCreated }: { session: Session; onShowCreated: () => void }) {
  const applied = session.applied;
  const created = applied?.trailsCreated ?? 0;

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-500" />
        <h2 className="text-sm font-semibold">Applied</h2>
        <span className="text-xs text-muted-foreground">{formatDateTime(session.appliedAt)}</span>
      </div>

      {applied ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure value={applied.trailsCreated} label="trails created" />
            <Figure value={applied.trailsUpdated} label="trails updated" />
            <Figure value={applied.linksWritten} label="links written" />
            <Figure value={applied.featuresExcluded} label="features excluded" />
          </div>

          <LinkedWithoutChanges updated={applied.trailsUpdated} linked={applied.trailsLinked} />

          <Conflicts conflicts={applied.conflicts} />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {created > 0 && (
              <Button size="sm" variant="outline" onClick={onShowCreated}>
                Show the {created} new trail(s)
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <NavLink to={paths.trailImport}>
                <ArrowLeft />
                Back to sessions
              </NavLink>
            </Button>
          </div>

          {created > 0 && (
            <p className="text-xs text-muted-foreground">
              A new trail is created unverified, so the app does not list it until someone has looked at it.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This session was applied before the run was recorded, so there are no figures for it. Its links are on the
          trails all the same.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        The decisions below are history now — an applied session cannot be decided again.
      </p>
    </div>
  );
}
