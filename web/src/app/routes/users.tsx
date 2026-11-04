// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition, useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { AuthorStatisticResponse } from "@/api/generated/model";
import { authorsQueryOptions, reportersQueryOptions, useUnbanUser } from "@/features/users/api/users";
import { BanSheet, type BanTarget } from "@/features/users/components/ban-sheet";
import {
  emptyExplanation,
  reporterAccuracy,
  strikeSeverity,
  totalStrikes,
  withheldNote,
  withheldReporters,
} from "@/features/users/utils/user-statistics";
import { Page, PageHeader } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayName } from "@/utils/format";

const severityClass: Record<string, string> = {
  none: "text-muted-foreground",
  watch: "text-yellow-700",
  serious: "font-semibold text-red-700",
};

export default function UsersPage() {
  return (
    <Page width="wide">
      <PageHeader title="Users" description="Who reports, and whose content gets removed." />

      <Tabs defaultValue="reporters">
        <TabsList>
          <TabsTrigger value="reporters">Reporters</TabsTrigger>
          <TabsTrigger value="authors">Authors</TabsTrigger>
        </TabsList>

        <TabsContent value="reporters">
          <PagedTab>{(page, setPage) => <ReportersTable page={page} onPageChange={setPage} />}</PagedTab>
        </TabsContent>
        <TabsContent value="authors">
          <PagedTab>{(page, setPage) => <AuthorsTable page={page} onPageChange={setPage} />}</PagedTab>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

// keep-comment: the page lives outside the boundary so a failed page keeps its number on retry
function PagedTab({ children }: { children: (page: number, setPage: (page: number) => void) => ReactNode }) {
  const [page, setPage] = useState(1);
  const changePage = (next: number) => startTransition(() => setPage(next));

  return <QueryBoundary fallback={<LoadingRows />}>{children(page, changePage)}</QueryBoundary>;
}

interface TableProps {
  page: number;
  onPageChange: (page: number) => void;
}

function ReportersTable({ page, onPageChange }: TableProps) {
  const { data } = useSuspenseQuery(reportersQueryOptions(page));
  const rows = data.items;

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
                <TableCell className="text-right">{row.total}</TableCell>
                <TableCell className="text-right">{row.pending}</TableCell>
                <TableCell className="text-right">{row.dismissed}</TableCell>
                <TableCell className="text-right">{row.upheld}</TableCell>
                <TableCell className="text-right" data-testid="reporter-accuracy">
                  {accuracy === null ? "Nothing decided" : `${accuracy}%`}
                </TableCell>
                <TableCell>{new Date(row.lastReportedAt).toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Pager page={page} hasMore={data.hasMore} onChange={onPageChange} label={count(data.totalCount, "reporter")} />
    </div>
  );
}

function AuthorsTable({ page, onPageChange }: TableProps) {
  const { data } = useSuspenseQuery(authorsQueryOptions(page));
  const [banning, setBanning] = useState<BanTarget | null>(null);
  const rows = data.items;

  if (rows.length === 0) return <Empty>{emptyExplanation("authors")}</Empty>;

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableCaption>
          {totalStrikes(rows)} strikes on this page. One strike is one piece of content removed, however many people
          reported it.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nickname</TableHead>
            <TableHead className="text-right">Strikes</TableHead>
            <TableHead className="text-right">Bans</TableHead>
            <TableHead className="text-right">Account</TableHead>
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
                {row.strikes}
              </TableCell>
              <TableCell data-testid="author-bans" className="text-right">
                {row.banCount}
              </TableCell>
              <TableCell className="text-right">
                <AccountAction author={row} onBan={setBanning} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pager page={page} hasMore={data.hasMore} onChange={onPageChange} label={count(data.totalCount, "author")} />

      {banning && <BanSheet target={banning} onClose={() => setBanning(null)} />}
    </div>
  );
}

function AccountAction({ author, onBan }: { author: AuthorStatisticResponse; onBan: (target: BanTarget) => void }) {
  const unban = useUnbanUser();
  const { identifier, nickName, strikes, bannedAt } = author;

  if (!identifier) {
    return (
      <Button variant="outline" size="sm" data-testid="ban-author" disabled title="This account is already deleted.">
        Ban
      </Button>
    );
  }

  if (!bannedAt) {
    return (
      <Button
        variant="outline"
        size="sm"
        data-testid="ban-author"
        onClick={() => onBan({ identifier, nickName, strikes })}
      >
        Ban
      </Button>
    );
  }

  return (
    <span className="flex items-center justify-end gap-2">
      <span data-testid="banned-since" className="text-muted-foreground text-xs">
        Banned {new Date(bannedAt).toLocaleDateString()}
      </span>
      <Button
        variant="outline"
        size="sm"
        data-testid="unban-author"
        disabled={unban.isPending}
        onClick={() => unban.mutate({ identifier, nickName })}
      >
        {unban.isPending && <Loader2 className="size-4 animate-spin" />}
        Lift ban
      </Button>
    </span>
  );
}

function count(total: number, noun: string) {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
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

function Empty({ children }: { children: ReactNode }) {
  return (
    <div data-testid="empty-tab" className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
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
        aria-label="Previous page"
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
        aria-label="Next page"
        disabled={!hasMore}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
