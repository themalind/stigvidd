// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router";
import type { ContentReportDetailResponse } from "@/api/generated/model";
import { FilterRow } from "@/components/filter-row";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { reportCountsQueryOptions, type QueueFilters } from "@/features/moderation/api/content-reports";
import { ReportQueue } from "@/features/moderation/components/report-queue";
import { useUnbanUser } from "@/features/users/api/users";
import { BanSheet } from "@/features/users/components/ban-sheet";

const STATUS_FILTERS = ["Pending", "Dismissed", "Upheld", "ContentExpired", "All"] as const;
const TYPE_FILTERS = ["All", "Review", "TrailObstacle", "HikeImage", "Event", "EventPost", "EventImage"] as const;
const OUTCOME_FILTERS = ["All", "Hidden", "AlreadyHidden", "WithheldReporterDismissed"] as const;

type FilterKey = "status" | "contentType" | "hideOutcome";

// keep-comment: the status filter defaults to Pending, so "All" has to be written to the address explicitly
function useQueueFilters() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "Pending";
  const contentType = params.get("contentType") ?? "All";
  const hideOutcome = params.get("hideOutcome") ?? "All";

  const filters: QueueFilters = {
    status: status === "All" ? undefined : status,
    contentType: contentType === "All" ? undefined : contentType,
    hideOutcome: hideOutcome === "All" ? undefined : hideOutcome,
    page: Math.max(1, Number(params.get("page")) || 1),
  };

  const change = (update: (next: URLSearchParams) => void) =>
    startTransition(() =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        update(next);
        return next;
      }),
    );

  const setFilter = (key: FilterKey, value: string) =>
    change((next) => {
      next.delete("page");
      const isDefault = value === (key === "status" ? "Pending" : "All");
      if (isDefault) next.delete(key);
      else next.set(key, value);
    });

  const setPage = (page: number) => change((next) => next.set("page", String(page)));

  return { filters, selected: { status, contentType, hideOutcome }, setFilter, setPage };
}

export default function ModerationPage() {
  const { filters, selected, setFilter, setPage } = useQueueFilters();
  const { data: counts } = useQuery(reportCountsQueryOptions());

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Flag className="size-5" />
        <h1 className="text-lg font-semibold">Moderation</h1>
        {counts && (
          <span className="text-sm text-muted-foreground">
            {counts.pending} pending · {counts.dismissed} dismissed · {counts.upheld} upheld · {counts.contentExpired}{" "}
            expired
          </span>
        )}
      </header>

      <div className="flex flex-wrap gap-4">
        <FilterRow
          label="Status"
          options={STATUS_FILTERS}
          value={selected.status}
          onChange={(v) => setFilter("status", v)}
        />
        <FilterRow
          label="Type"
          options={TYPE_FILTERS}
          value={selected.contentType}
          onChange={(v) => setFilter("contentType", v)}
        />
        <FilterRow
          label="Outcome"
          options={OUTCOME_FILTERS}
          value={selected.hideOutcome}
          onChange={(v) => setFilter("hideOutcome", v)}
        />
      </div>

      <QueryBoundary
        fallback={
          <div className="flex flex-col gap-2 lg:w-[26rem]">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        }
      >
        <ReportQueue
          filters={filters}
          onPageChange={setPage}
          renderAuthorActions={(detail) => <AuthorBanControls detail={detail} />}
        />
      </QueryBoundary>
    </div>
  );
}

function AuthorBanControls({ detail }: { detail: ContentReportDetailResponse }) {
  const { report } = detail;
  const [banning, setBanning] = useState(false);
  const unban = useUnbanUser();

  if (!report.authorIdentifier) return null;

  const author = { identifier: report.authorIdentifier, nickName: report.authorNickName };

  if (report.authorBannedAt) {
    return (
      <>
        <p data-testid="author-banned-since" className="text-muted-foreground">
          Banned {new Date(report.authorBannedAt).toLocaleDateString()}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          data-testid="unban-author"
          disabled={unban.isPending}
          onClick={() => unban.mutate(author)}
        >
          {unban.isPending && <Loader2 className="size-4 animate-spin" />}
          Lift the ban
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="mt-3" data-testid="ban-author" onClick={() => setBanning(true)}>
        Ban this account
      </Button>
      {banning && (
        <BanSheet
          target={{ ...author, strikes: detail.authorStrikes }}
          initialReason={`Moderation: ${report.identifier}`}
          onClose={() => setBanning(false)}
        />
      )}
    </>
  );
}
