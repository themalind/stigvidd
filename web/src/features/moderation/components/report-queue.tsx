// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentReportDetailResponse } from "@/api/generated/model";
import { QueryBoundary } from "@/components/query-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { reportsQueryOptions, type QueueFilters } from "@/features/moderation/api/content-reports";
import { didNotHide, hideOutcomeExplanation, narrowedBy } from "@/features/moderation/utils/moderation-review";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { formatDateTime } from "@/utils/format";
import { ReportDetail } from "./report-detail";

interface Props {
  filters: QueueFilters;
  onPageChange: (page: number) => void;
  renderAuthorActions?: (detail: ContentReportDetailResponse) => ReactNode;
}

export function ReportQueue({ filters, onPageChange, renderAuthorActions }: Props) {
  const { data } = useSuspenseQuery(reportsQueryOptions(filters));
  const reports = data.items;
  const [picked, setPicked] = useState<string | null>(null);
  // keep-comment: falls back to the first row as the list changes, so the keyboard never lands on nothing
  const selected = reports.some((r) => r.identifier === picked) ? picked : (reports[0]?.identifier ?? null);
  const narrowed = narrowedBy(filters);

  const step = (offset: number) => {
    if (reports.length === 0) return;
    const index = reports.findIndex((r) => r.identifier === selected);
    setPicked(reports[Math.min(Math.max(index + offset, 0), reports.length - 1)].identifier);
  };

  useKeyboardShortcuts({ j: () => step(1), k: () => step(-1) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section className="flex flex-col gap-2">
        {reports.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            {narrowed.length > 0 ? `Nothing matches ${narrowed.join(", ")}.` : "Nothing has been reported."}
          </div>
        )}

        {reports.map((row) => (
          <button
            key={row.identifier}
            type="button"
            data-testid="report-row"
            aria-current={row.identifier === selected}
            onClick={() => setPicked(row.identifier)}
            className={`rounded-md border p-3 text-left text-sm ${
              row.identifier === selected ? "border-primary" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline">{row.contentType}</Badge>
              <Badge variant="outline">{row.reason}</Badge>
              <Badge variant="outline">{row.status}</Badge>
              {didNotHide(row.hideOutcome) && (
                <span
                  data-testid="did-not-hide"
                  title={hideOutcomeExplanation(row.hideOutcome) ?? undefined}
                  className="rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-900"
                >
                  did not hide
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              {row.reporterNickName ?? "Deleted reporter"} reported {row.authorNickName ?? "a deleted author"}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</p>
          </button>
        ))}

        <nav className="flex items-center justify-between pt-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            aria-label="Previous page"
            disabled={filters.page <= 1}
            onClick={() => onPageChange(filters.page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-muted-foreground">
            Page {filters.page} of {data.totalCount} report{data.totalCount === 1 ? "" : "s"}
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label="Next page"
            disabled={!data.hasMore}
            onClick={() => onPageChange(filters.page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      </section>

      <section className="flex flex-col gap-4">
        {selected ? (
          <QueryBoundary fallback={<Skeleton className="h-64 w-full" />} resetKeys={[selected]}>
            <ReportDetail key={selected} identifier={selected} renderAuthorActions={renderAuthorActions} />
          </QueryBoundary>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Pick a report to see what was reported.
          </div>
        )}
      </section>
    </div>
  );
}
