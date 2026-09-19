// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, Loader2, TriangleAlert } from "lucide-react";
import {
  cancelOutboxMail,
  getOutboxCounts,
  getOutboxMail,
  getOutboxMailBody,
  getOutboxMails,
  purgeOutbox,
  retryOutboxMail,
  type OutboxCounts,
  type OutboxMailBody,
  type OutboxMailDetail,
  type OutboxMailSummary,
} from "@/api/mail-outbox";
import {
  canCancel,
  canRetry,
  canRevealBody,
  describeNextAttempt,
  describePurge,
  describeRedaction,
  isValidPurgeCutoff,
  statusTone,
  OUTBOX_STATUS_FILTERS,
} from "@/lib/mail-outbox";
import MailPreview from "@/components/mail/mail-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

// Below the sweep's own SentRetentionDays, or the dialog could never find a row: the automatic
// retention run has already deleted everything older than that.
const DefaultPurgeDays = 3;

// Same reading as the trail-import badges: green is done, blue is in flight, red went wrong,
// grey is inert.
const toneStyle: Record<string, string> = {
  ok: "bg-emerald-600 text-white",
  busy: "bg-sky-600 text-white",
  bad: "bg-destructive text-white",
  muted: "bg-muted text-muted-foreground border-border",
  warn: "bg-amber-500 text-black",
};

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant="outline" className={toneStyle[statusTone(status)] ?? ""}>
      {status ?? "Unknown"}
    </Badge>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function MailOutboxPage() {
  const [mails, setMails] = useState<OutboxMailSummary[] | null>(null);
  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [detail, setDetail] = useState<OutboxMailDetail | null>(null);
  // Held separately from `detail` and fetched only on request. Opening a mail must not pull its
  // body down: that is where the recipient's name and, for a password reset, a working link are,
  // and the API logs every read of one.
  const [body, setBody] = useState<OutboxMailBody | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [status, setStatus] = useState<string>("All");
  const [recipient, setRecipient] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDays, setPurgeDays] = useState(String(DefaultPurgeDays));

  const filters = useMemo(
    () => ({
      status: status === "All" ? undefined : status,
      recipient: recipient.trim() === "" ? undefined : recipient.trim(),
    }),
    [status, recipient],
  );

  const load = useCallback(async () => {
    try {
      const [paged, loadedCounts] = await Promise.all([
        getOutboxMails({ ...filters, page, pageSize: PageSize }),
        getOutboxCounts(),
      ]);

      setMails(paged.items ?? []);
      setTotal(paged.totalCount ?? 0);
      setHasMore(paged.hasMore ?? false);
      setCounts(loadedCounts);
    } catch (error) {
      setMails([]);
      toast.error(
        error instanceof Error ? error.message : "The outbox could not be loaded.",
      );
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filtering from page 4 would otherwise land on a page the narrower result has no rows for.
  useEffect(() => {
    setPage(1);
  }, [status, recipient]);

  async function openDetail(identifier: string) {
    try {
      setBody(null);
      setDetail(await getOutboxMail(identifier));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The mail could not be read.");
    }
  }

  async function revealBody(identifier: string) {
    setRevealing(true);

    try {
      setBody(await getOutboxMailBody(identifier));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The body could not be read.");
    } finally {
      setRevealing(false);
    }
  }

  async function act(
    identifier: string,
    action: (id: string) => Promise<OutboxMailDetail>,
    done: string,
  ) {
    setBusy(true);

    try {
      await action(identifier);
      toast.success(done);
      setDetail(null);
      setBody(null);
      await load();
    } catch (error) {
      // The API refuses a mail that has moved on since the page was rendered — most often one
      // the dispatcher claimed a moment ago — and its message says which.
      toast.error(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPurge() {
    const days = Number(purgeDays);

    if (!isValidPurgeCutoff(days)) {
      toast.error("Enter a whole number of days between 1 and 3650.");
      return;
    }

    setBusy(true);

    try {
      const result = await purgeOutbox(days);
      toast.success(
        `${result.deleted} sent mail${result.deleted === 1 ? "" : "s"} deleted.`,
      );
      setPurging(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The outbox could not be purged.");
    } finally {
      setBusy(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PageSize));

  return (
    <main className="container mx-auto max-w-6xl space-y-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">Mail outbox</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every mail the API has queued, sent, failed to send or been stopped from sending.
            This is where a mail that never arrived is diagnosed — and the only place a failed
            one can be put back in the queue.
          </p>
        </div>

        <Button variant="outline" onClick={() => setPurging(true)} data-testid="open-purge">
          Purge sent mail
        </Button>
      </div>

      {counts && (
        <div className="flex flex-wrap gap-2 text-sm" data-testid="counts">
          {(
            [
              ["Pending", counts.pending],
              ["Sending", counts.sending],
              ["Sent", counts.sent],
              ["Failed", counts.failed],
              ["Cancelled", counts.cancelled],
            ] as const
          ).map(([label, count]) => (
            <span
              key={label}
              className="rounded-xs border border-input px-2 py-1 text-muted-foreground"
            >
              {label}: <span className="text-foreground">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Status</span>
          {OUTBOX_STATUS_FILTERS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === status ? "default" : "ghost"}
              onClick={() => setStatus(option)}
            >
              {option}
            </Button>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setRecipient(recipientInput);
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

      {mails === null && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {mails?.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No mail matches these filters.
        </div>
      )}

      {mails !== null && mails.length > 0 && (
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
            {mails.map((mail) => (
              <TableRow key={mail.identifier} data-testid={`row-${mail.identifier}`}>
                <TableCell>
                  <StatusBadge status={mail.status} />
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
                  {describeNextAttempt(mail) && (
                    <span className="block text-xs text-muted-foreground">
                      {describeNextAttempt(mail)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{mail.templateKey ?? "—"}</TableCell>
                <TableCell className="text-xs">{formatDate(mail.createdAt)}</TableCell>
                <TableCell className="text-right">{mail.attempts}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void openDetail(mail.identifier)}
                    data-testid={`open-${mail.identifier}`}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} mail{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            data-testid="next-page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Sheet
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetail(null);
            setBody(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <StatusBadge status={detail.email.status} />
                  <span className="truncate">{detail.email.subject}</span>
                </SheetTitle>
                <SheetDescription asChild>
                  <div className="space-y-1 text-left">
                    <div>
                      To {detail.email.toAddress}
                      {detail.email.toName ? ` (${detail.email.toName})` : ""}
                    </div>
                    <div>
                      Queued {formatDate(detail.email.createdAt)} · {detail.email.attempts}{" "}
                      attempt{detail.email.attempts === 1 ? "" : "s"}
                      {detail.email.sentAt ? ` · sent ${formatDate(detail.email.sentAt)}` : ""}
                    </div>
                    {detail.email.lastError && (
                      <div className="text-destructive">{detail.email.lastError}</div>
                    )}
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="px-4">
                {/* Three states, and the split matters. A body is not fetched with the mail:
                    it carries the recipient's name and, for a password reset, a live link, so
                    reading one is a deliberate act the API records against the operator. */}
                {!canRevealBody(detail.email) ? (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="body-redacted"
                  >
                    {describeRedaction(detail.email)}
                  </p>
                ) : body ? (
                  /* The same sandboxed renderer the template editor uses: a mail body is
                     operator-authored markup, and a row can also have been written straight
                     into Postgres by hand. */
                  <MailPreview
                    preview={{
                      subject: detail.email.subject,
                      bodyHtml: body.bodyHtml,
                      bodyText: body.bodyText,
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      disabled={revealing}
                      onClick={() => void revealBody(detail.email.identifier)}
                      data-testid="reveal-body"
                    >
                      {revealing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                      Show the mail body
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      The body is not loaded with the mail. It contains the recipient&apos;s name
                      and, for a password reset, a working link — so opening it is recorded.
                    </p>
                  </div>
                )}
              </div>

              <SheetFooter>
                {canRetry(detail.email) && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(detail.email.identifier, retryOutboxMail, "Mail queued again.")
                    }
                    data-testid="retry"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Retry now
                  </Button>
                )}

                {canCancel(detail.email) && (
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void act(detail.email.identifier, cancelOutboxMail, "Mail cancelled.")
                    }
                    data-testid="cancel"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    Cancel this mail
                  </Button>
                )}

                {!canRetry(detail.email) && !canCancel(detail.email) && (
                  <p className="text-sm text-muted-foreground">
                    {detail.email.status === "Sending"
                      ? "This mail is being sent right now, so it can be neither retried nor cancelled."
                      : detail.email.status === "Sent"
                        ? "Nothing to do — this mail has already been sent."
                        : "Nothing to do — this mail can no longer be sent, because its rendered body has been cleared under the retention policy."}
                  </p>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={purging} onOpenChange={(open) => !open && setPurging(false)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Purge sent mail</SheetTitle>
            <SheetDescription>{describePurge(Number(purgeDays) || 0, counts?.sent ?? 0)}</SheetDescription>
          </SheetHeader>

          <div className="space-y-2 px-4">
            <Label htmlFor="purge-days">Older than (days)</Label>
            <Input
              id="purge-days"
              type="number"
              min={1}
              max={3650}
              value={purgeDays}
              onChange={(e) => setPurgeDays(e.target.value)}
              data-testid="purge-days"
            />
            <p className="text-xs text-muted-foreground">This cannot be undone.</p>
          </div>

          <SheetFooter>
            <Button
              variant="destructive"
              disabled={busy || !isValidPurgeCutoff(Number(purgeDays))}
              onClick={() => void confirmPurge()}
              data-testid="confirm-purge"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Delete them
            </Button>
            <Button variant="ghost" onClick={() => setPurging(false)}>
              Keep everything
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}
