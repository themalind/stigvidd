// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OUTBOX_PAGE_SIZE, outboxMailsQueryOptions, type OutboxFilters } from "@/features/mail/api/mail-outbox";
import { describeNextAttempt } from "@/features/mail/utils/mail-outbox";
import { formatDateTime } from "@/utils/format";
import { OutboxStatusBadge } from "./outbox-status-badge";

interface Props {
  filters: OutboxFilters;
  onPageChange: (page: number) => void;
  onOpen: (identifier: string) => void;
}

export function OutboxTable({ filters, onPageChange, onOpen }: Props) {
  const { data } = useSuspenseQuery(outboxMailsQueryOptions(filters));
  const { page } = filters;
  const lastPage = Math.max(1, Math.ceil(data.totalCount / OUTBOX_PAGE_SIZE));

  return (
    <>
      {data.items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No mail matches these filters.
        </div>
      ) : (
        <Table>
          <TableCaption>Newest first — an outbox is read backwards from the incident.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Queued</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((mail) => {
              const nextAttempt = describeNextAttempt(mail);

              return (
                <TableRow key={mail.identifier} data-testid={`row-${mail.identifier}`}>
                  <TableCell>
                    <OutboxStatusBadge status={mail.status} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">{mail.toAddress}</TableCell>
                  <TableCell className="max-w-[18rem] truncate">
                    {mail.subject}
                    {mail.lastError && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <TriangleAlert className="size-3" aria-hidden="true" />
                        <span className="truncate">{mail.lastError}</span>
                      </span>
                    )}
                    {nextAttempt && <span className="block text-xs text-muted-foreground">{nextAttempt}</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{mail.templateKey ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(mail.createdAt)}</TableCell>
                  <TableCell className="text-right">{mail.attempts}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpen(mail.identifier)}
                      data-testid={`open-${mail.identifier}`}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {data.totalCount} mail{data.totalCount === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            data-testid="previous-page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            Page {page} of {lastPage}
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label="Next page"
            disabled={!data.hasMore}
            onClick={() => onPageChange(page + 1)}
            data-testid="next-page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
