// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { AuthorStatisticResponse } from "@/api/generated/model";
import { countOf, Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authorsQueryOptions, useUnbanUser } from "@/features/users/api/users";
import { emptyExplanation, strikeSeverity, totalStrikes } from "@/features/users/utils/user-statistics";
import { displayName } from "@/utils/format";
import { BanSheet, type BanTarget } from "./ban-sheet";
import { EmptyTab, type PagedTableProps } from "./statistics-tab";

const severityClass: Record<string, string> = {
  none: "text-muted-foreground",
  watch: "text-yellow-700",
  serious: "font-semibold text-red-700",
};

export function AuthorsTable({ page, onPageChange }: PagedTableProps) {
  const { data } = useSuspenseQuery(authorsQueryOptions(page));
  const [banning, setBanning] = useState<BanTarget | null>(null);
  const rows = data.items;

  if (rows.length === 0) return <EmptyTab>{emptyExplanation("authors")}</EmptyTab>;

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

      <Pager page={page} hasMore={data.hasMore} onChange={onPageChange} summary={countOf(data.totalCount, "author")} />

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
