// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import {
  getAuthors,
  getReporters,
  type AuthorStatistic,
  type ReporterStatistic,
} from "@/api/content-reports";
import {
  displayName,
  emptyExplanation,
  reporterAccuracy,
  strikeSeverity,
  totalStrikes,
  withheldNote,
  withheldReporters,
} from "@/lib/moderation-statistics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PageSize = 25;

const severityClass: Record<string, string> = {
  none: "text-muted-foreground",
  watch: "text-yellow-700",
  serious: "font-semibold text-red-700",
};

export default function UsersPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center gap-3">
        <Users className="size-5" />
        <h1 className="text-lg font-semibold">Users</h1>
      </header>

      <Tabs defaultValue="reporters">
        <TabsList>
          <TabsTrigger value="reporters">Reporters</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
        </TabsList>

        <TabsContent value="reporters">
          <ReportersTab />
        </TabsContent>
        <TabsContent value="authors">
          <AuthorsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

type PagedStatistics<T> = {
  items?: T[];
  totalCount?: number;
  hasMore?: boolean;
};

// Both tabs load the same way. State is set from the promise callback, and a response that
// arrives after the page moved on is dropped rather than rendered over the newer one.
function usePagedStatistics<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PagedStatistics<T>>,
  page: number,
  failureMessage: string,
) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let current = true;

    fetchPage(page, PageSize)
      .then((paged) => {
        if (!current) return;

        setRows(paged.items ?? []);
        setTotal(paged.totalCount ?? 0);
        setHasMore(paged.hasMore ?? false);
      })
      .catch((error: unknown) => {
        if (!current) return;

        toast.error(error instanceof Error ? error.message : failureMessage);
      });

    return () => {
      current = false;
    };
  }, [fetchPage, page, failureMessage]);

  return { rows, total, hasMore };
}

function ReportersTab() {
  const [page, setPage] = useState(1);
  const { rows, total, hasMore } = usePagedStatistics<ReporterStatistic>(
    getReporters,
    page,
    "The reporters could not be loaded.",
  );

  if (rows === null) return <LoadingRows />;

  if (rows.length === 0) return <Empty>{emptyExplanation("reporters")}</Empty>;

  const withheld = withheldReporters(rows);

  return (
    <div className="flex flex-col gap-2">
      {withheld.length > 0 && (
        <p data-testid="withheld-summary" className="text-sm text-yellow-800">
          {withheld.length} of these accounts no longer hide anything when they report.
        </p>
      )}

      <Table>
        <TableCaption>Sorted by dismissed reports, most first.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nickname</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Dismissed</TableHead>
            <TableHead className="text-right">Upheld</TableHead>
            <TableHead className="text-right">Upheld share</TableHead>
            <TableHead>Last report</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const note = withheldNote(row);
            const accuracy = reporterAccuracy(row);

            return (
              <TableRow key={`${row.nickName ?? "gone"}-${index}`} data-testid="reporter-row">
                <TableCell>
                  {displayName(row.nickName)}
                  {note && (
                    <span
                      data-testid="reports-withheld"
                      title={note}
                      className="ml-2 rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-900"
                    >
                      reports withheld
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">{row.total ?? 0}</TableCell>
                <TableCell className="text-right">{row.pending ?? 0}</TableCell>
                <TableCell className="text-right">{row.dismissed ?? 0}</TableCell>
                <TableCell className="text-right">{row.upheld ?? 0}</TableCell>
                <TableCell className="text-right" data-testid="reporter-accuracy">
                  {accuracy === null ? "Nothing decided" : `${accuracy}%`}
                </TableCell>
                <TableCell>
                  {row.lastReportedAt ? new Date(row.lastReportedAt).toLocaleString() : ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Pager
        page={page}
        hasMore={hasMore}
        onChange={setPage}
        label={`${total} reporter${total === 1 ? "" : "s"}`}
      />
    </div>
  );
}

function AuthorsTab() {
  const [page, setPage] = useState(1);
  const { rows, total, hasMore } = usePagedStatistics<AuthorStatistic>(
    getAuthors,
    page,
    "The authors could not be loaded.",
  );

  if (rows === null) return <LoadingRows />;

  if (rows.length === 0) return <Empty>{emptyExplanation("authors")}</Empty>;

  return (
    <div className="flex flex-col gap-2">
      <Table>
        {/* A strike is one piece of content, however many people reported it. Saying so
            here keeps the list from being read as a report count. */}
        <TableCaption>
          {totalStrikes(rows)} strikes on this page. One strike is one piece of content
          removed, however many people reported it.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nickname</TableHead>
            <TableHead className="text-right">Strikes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.nickName ?? "gone"}-${index}`} data-testid="author-row">
              <TableCell>{displayName(row.nickName)}</TableCell>
              <TableCell
                data-testid="author-strikes"
                className={`text-right ${severityClass[strikeSeverity(row.strikes)]}`}
              >
                {row.strikes ?? 0}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pager
        page={page}
        hasMore={hasMore}
        onChange={setPage}
        label={`${total} author${total === 1 ? "" : "s"}`}
      />
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="empty-tab"
      className="rounded-md border border-dashed p-6 text-sm text-muted-foreground"
    >
      {children}
    </div>
  );
}

function Pager({
  page,
  hasMore,
  onChange,
  label,
}: {
  page: number;
  hasMore: boolean;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <nav className="flex items-center justify-between text-sm">
      <Button
        size="sm"
        variant="outline"
        data-testid="previous-page"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(page - 1, 1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-muted-foreground">
        Page {page} of {label}
      </span>
      <Button
        size="sm"
        variant="outline"
        data-testid="next-page"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
