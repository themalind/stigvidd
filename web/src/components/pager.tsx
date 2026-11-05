// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  hasMore: boolean;
  onChange: (page: number) => void;
  summary?: ReactNode;
  pageCount?: number;
  // keep-comment: true while a placeholder page is shown, so Next cannot skip past a page that has not arrived
  busy?: boolean;
  className?: string;
}

export function Pager({ page, hasMore, onChange, summary, pageCount, busy = false, className }: Props) {
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-4 text-sm text-muted-foreground", className)}
    >
      <span>{summary}</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-label="Previous page"
          data-testid="previous-page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span>
          Page {page}
          {pageCount !== undefined && ` of ${pageCount}`}
        </span>
        <Button
          size="sm"
          variant="outline"
          aria-label="Next page"
          data-testid="next-page"
          disabled={!hasMore || busy}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

export function countOf(total: number, noun: string): string {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}
