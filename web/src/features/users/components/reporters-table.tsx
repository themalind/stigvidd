// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { countOf, Pager } from "@/components/pager";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reportersQueryOptions } from "@/features/users/api/users";
import {
  emptyExplanation,
  reporterAccuracy,
  withheldNote,
  withheldReporters,
} from "@/features/users/utils/user-statistics";
import { displayName } from "@/utils/format";
import { EmptyTab, type PagedTableProps } from "./statistics-tab";

export function ReportersTable({ page, onPageChange }: PagedTableProps) {
  const { data } = useSuspenseQuery(reportersQueryOptions(page));
  const rows = data.items;

  if (rows.length === 0) return <EmptyTab>{emptyExplanation("reporters")}</EmptyTab>;

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
                      className="ml-2 rounded-md bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-900"
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

      <Pager
        page={page}
        hasMore={data.hasMore}
        onChange={onPageChange}
        summary={countOf(data.totalCount, "reporter")}
      />
    </div>
  );
}
