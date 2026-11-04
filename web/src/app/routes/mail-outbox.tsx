// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { FilterRow } from "@/components/filter-row";
import { Page } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { outboxCountsQueryOptions, type OutboxFilters } from "@/features/mail/api/mail-outbox";
import { OutboxMailSheet } from "@/features/mail/components/outbox-mail-sheet";
import { OutboxTable } from "@/features/mail/components/outbox-table";
import { PurgeOutboxSheet } from "@/features/mail/components/purge-outbox-sheet";
import { OUTBOX_STATUS_FILTERS } from "@/features/mail/utils/mail-outbox";

function useOutboxFilters() {
  const [params, setParams] = useSearchParams();
  const filters: OutboxFilters = {
    status: params.get("status") ?? undefined,
    recipient: params.get("recipient") ?? undefined,
    page: Math.max(1, Number(params.get("page")) || 1),
  };

  // keep-comment: a filter change drops the page, or page 4 of a narrower result would be empty
  function update(changes: Partial<Record<keyof OutboxFilters, string | undefined>>) {
    startTransition(() =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (!("page" in changes)) next.delete("page");
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      }),
    );
  }

  return { filters, update };
}

export default function MailOutboxPage() {
  const { filters, update } = useOutboxFilters();
  const counts = useQuery(outboxCountsQueryOptions());
  const [recipientInput, setRecipientInput] = useState(filters.recipient ?? "");
  const [openMail, setOpenMail] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const activeStatus = filters.status ?? "All";

  return (
    <Page width="wide" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">Mail outbox</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every mail the API has queued, sent, failed to send or been stopped from sending. This is where a mail that
            never arrived is diagnosed — and the only place a failed one can be put back in the queue.
          </p>
        </div>

        <Button variant="outline" onClick={() => setPurging(true)} data-testid="open-purge">
          Purge sent mail
        </Button>
      </div>

      {counts.data && (
        <div className="flex flex-wrap gap-2 text-sm" data-testid="counts">
          {(
            [
              ["Pending", counts.data.pending],
              ["Sending", counts.data.sending],
              ["Sent", counts.data.sent],
              ["Failed", counts.data.failed],
              ["Cancelled", counts.data.cancelled],
            ] as const
          ).map(([label, count]) => (
            <span key={label} className="rounded-xs border border-input px-2 py-1 text-muted-foreground">
              {label}: <span className="text-foreground">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <FilterRow
          label="Status"
          options={OUTBOX_STATUS_FILTERS}
          value={activeStatus}
          onChange={(option) => update({ status: option === "All" ? undefined : option })}
        />

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ recipient: recipientInput.trim() || undefined });
          }}
        >
          <Input
            aria-label="Recipient"
            placeholder="Recipient contains…"
            className="h-8 w-56"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            data-testid="recipient-filter"
          />
          <Button size="sm" variant="outline" type="submit">
            Search
          </Button>
        </form>
      </div>

      <QueryBoundary>
        <OutboxTable filters={filters} onPageChange={(page) => update({ page: String(page) })} onOpen={setOpenMail} />
      </QueryBoundary>

      <OutboxMailSheet identifier={openMail} onClose={() => setOpenMail(null)} />
      {purging && <PurgeOutboxSheet sentCount={counts.data?.sent ?? 0} onClose={() => setPurging(false)} />}
    </Page>
  );
}
