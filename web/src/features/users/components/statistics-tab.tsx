// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition, useState, type ReactNode } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";

export interface PagedTableProps {
  page: number;
  onPageChange: (page: number) => void;
}

// keep-comment: the page lives outside the boundary so a failed page keeps its number on retry
export function PagedTab({ children }: { children: (props: PagedTableProps) => ReactNode }) {
  const [page, setPage] = useState(1);
  const onPageChange = (next: number) => startTransition(() => setPage(next));

  return <QueryBoundary fallback={<LoadingRows />}>{children({ page, onPageChange })}</QueryBoundary>;
}

export function EmptyTab({ children }: { children: ReactNode }) {
  return (
    <div data-testid="empty-tab" className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function LoadingRows() {
  return (
    <div data-testid="loading-rows" className="flex flex-col gap-2 pt-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
