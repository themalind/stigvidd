// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { NavLink, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { useSearchState } from "@/hooks/use-search-state";
import { ProposalDecision, type MatchConfidence } from "@/api/generated/model";
import { confidenceOrder, sessionQueryOptions, type ProposalFilters } from "@/features/trail-import/api/trail-import";
import { ApplyPanel } from "@/features/trail-import/components/apply-panel";
import { decisionLabel, StatusBadge } from "@/features/trail-import/components/badges";
import { ConfidenceSummary } from "@/features/trail-import/components/confidence-summary";
import { ProposalQueue } from "@/features/trail-import/components/proposal-queue";
import { trailsQueryOptions, useInvalidateTrailQueries } from "@/features/trails/api/trail";
import { FilterRow } from "@/components/filter-row";
import { paths } from "@/config/paths";
import { Page } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const DECISIONS = Object.values(ProposalDecision);
const DECISION_FILTERS = ["All", ...DECISIONS] as const;
const CONFIDENCES: MatchConfidence[] = [...confidenceOrder];

// keep-comment: Pending is the right default while reviewing and shows an empty list once the session is applied
function useReviewFilters(applied: boolean) {
  const { values, page, update, setPage } = useSearchState({
    confidence: "",
    decision: applied ? "All" : "Pending",
  });
  const filters: ProposalFilters = {
    confidence: CONFIDENCES.find((value) => value === values.confidence),
    decision: DECISIONS.find((value) => value === values.decision),
  };

  return {
    filters,
    decision: values.decision,
    page,
    setConfidence: (value: MatchConfidence | undefined) => update({ confidence: value }),
    setDecision: (value: string) => update({ decision: value }),
    setPage,
    showAll: () => update({ confidence: undefined, decision: "All" }),
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
    <Page width="full" className="space-y-4 py-6">
      <Button asChild variant="ghost" size="sm">
        <NavLink to={paths.trailImport}>
          <ArrowLeft />
          Sessions
        </NavLink>
      </Button>
      <QueryBoundary fallback={<Skeleton className="h-96 w-full" />}>
        <Review sessionId={sessionId} />
      </QueryBoundary>
    </Page>
  );
}
