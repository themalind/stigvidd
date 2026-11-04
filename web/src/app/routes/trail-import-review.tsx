// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { NavLink, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import {
  sessionQueryOptions,
  type Confidence,
  type Decision,
  type ProposalFilters,
} from "@/features/trail-import/api/trail-import";
import { ApplyPanel } from "@/features/trail-import/components/apply-panel";
import { decisionLabel, StatusBadge } from "@/features/trail-import/components/badges";
import { ConfidenceSummary } from "@/features/trail-import/components/confidence-summary";
import { ProposalQueue } from "@/features/trail-import/components/proposal-queue";
import { trailsQueryOptions, useInvalidateTrailQueries } from "@/features/trails/api/trail";
import { FilterRow } from "@/components/filter-row";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const DECISION_FILTERS = ["All", "Pending", "Accept", "Relink", "CreateNew", "Exclude", "Skip"] as const;

// keep-comment: Pending is the right default while reviewing and shows an empty list once the session is applied
function useReviewFilters(applied: boolean) {
  const [params, setParams] = useSearchParams();
  const defaultDecision = applied ? "All" : "Pending";
  const confidence = (params.get("confidence") ?? undefined) as Confidence | undefined;
  const decision = params.get("decision") ?? defaultDecision;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filters: ProposalFilters = {
    confidence,
    decision: decision === "All" ? undefined : (decision as Decision),
  };

  const change = (update: (next: URLSearchParams) => void) =>
    startTransition(() =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        update(next);
        return next;
      }),
    );

  return {
    filters,
    decision,
    page,
    setConfidence: (value: Confidence | undefined) =>
      change((next) => {
        next.delete("page");
        if (value) next.set("confidence", value);
        else next.delete("confidence");
      }),
    setDecision: (value: string) =>
      change((next) => {
        next.delete("page");
        if (value === defaultDecision) next.delete("decision");
        else next.set("decision", value);
      }),
    setPage: (value: number) => change((next) => next.set("page", String(value))),
    showAll: () =>
      change((next) => {
        next.delete("page");
        next.delete("confidence");
        if (defaultDecision === "All") next.delete("decision");
        else next.set("decision", "All");
      }),
  };
}

function Review({ sessionId }: { sessionId: number }) {
  const { data: session } = useSuspenseQuery(sessionQueryOptions(sessionId));
  const applied = session.status === "Applied";
  const { filters, decision, page, setConfidence, setDecision, setPage, showAll } = useReviewFilters(applied);
  const { data: trails } = useQuery(trailsQueryOptions());
  const invalidateTrails = useInvalidateTrailQueries();

  const narrowedBy = [
    filters.confidence ?? null,
    filters.decision ? (decisionLabel[filters.decision] ?? filters.decision) : null,
  ].filter((label): label is string => label !== null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">{session.fileName}</h1>
        <StatusBadge status={session.status} />
        <span className="text-xs text-muted-foreground">
          {session.featureCount} features · {session.source}
        </span>
      </div>

      <ConfidenceSummary counts={session.counts} selected={filters.confidence} onSelect={setConfidence} />

      <ApplyPanel
        session={session}
        onApplied={() => void invalidateTrails()}
        onShowCreated={() => setDecision("CreateNew")}
      />

      <FilterRow label="Decision" options={DECISION_FILTERS} value={decision} onChange={setDecision} />

      {narrowedBy.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Showing {narrowedBy.join(" · ")}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={showAll}>
            Show all
          </Button>
        </div>
      )}

      <QueryBoundary fallback={<Skeleton className="h-96 w-full" />}>
        <ProposalQueue
          key={`${filters.confidence}-${filters.decision}-${page}`}
          sessionId={sessionId}
          filters={filters}
          page={page}
          applied={applied}
          trails={trails}
          narrowedBy={narrowedBy}
          onPageChange={setPage}
          onShowAll={showAll}
        />
      </QueryBoundary>
    </>
  );
}

export default function TrailImportReviewPage() {
  const sessionId = Number(useParams().sessionId);

  return (
    <main>
      <div className="container mx-auto space-y-4 py-6">
        <Button asChild variant="ghost" size="sm">
          <NavLink to="/trail-import">
            <ArrowLeft />
            Sessions
          </NavLink>
        </Button>
        <QueryBoundary fallback={<Skeleton className="h-96 w-full" />}>
          <Review sessionId={sessionId} />
        </QueryBoundary>
      </div>
    </main>
  );
}
