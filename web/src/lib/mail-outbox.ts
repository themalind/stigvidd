// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The outbox page's decisions, kept out of the component so they can be tested without a
 * browser. Everything here is pure.
 *
 * The statuses mirror the backend's OutboxEmailStatus. They are a closed set that only ever
 * grows at the end, so listing them here rather than fetching them keeps the page honest about
 * what it knows how to render — an unrecognised one falls through to a neutral chip rather
 * than vanishing.
 */
export const OUTBOX_STATUSES = [
  "Pending",
  "Sending",
  "Sent",
  "Failed",
  "Cancelled",
] as const;

export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/** "All" is the page's sentinel for "do not send this filter at all". */
export const OUTBOX_STATUS_FILTERS = ["All", ...OUTBOX_STATUSES] as const;

type Row = { status?: string | null; redactedAt?: string | null };

/**
 * Only a settled, unsent mail can be put back in the queue.
 *
 * Sending is excluded deliberately and is the case that matters: the dispatcher holds that row
 * right now, and requeueing it would let it be claimed twice and the mail delivered twice. The
 * API refuses it with a 409 regardless — this just stops the page offering a button that
 * cannot work.
 */
export function canRetry(row: Row): boolean {
  if (row.redactedAt) return false;
  return row.status === "Failed" || row.status === "Cancelled";
}

/**
 * Whether this mail still has a body to fetch.
 *
 * A body is held only while the mail can still usefully be sent: cleared the moment it is sent,
 * and cleared on the retention clock once it has failed or been cancelled. The API answers 404
 * after that, so this is what stops the page offering a button that only produces an error.
 */
export function canRevealBody(row: Row): boolean {
  return !row.redactedAt;
}

/**
 * Why there is no body to show, for the panel that replaces the preview.
 *
 * Worth saying rather than rendering an empty frame: an empty preview reads as a render that
 * went wrong, and sends the operator looking for a bug instead of reading the rule.
 */
export function describeRedaction(row: Row): string {
  const cleared =
    row.status === "Sent"
      ? "was cleared when the mail was sent"
      : "has been cleared under the retention policy";

  return (
    `The rendered body ${cleared}. A body is kept only while the mail can still be sent — ` +
    `it carries the recipient's name and, for a password reset, a working link. ` +
    `The mail itself is kept until its own retention period ends.`
  );
}

/** Only a mail that has not been claimed yet can be stopped. Cancelling cannot un-send. */
export function canCancel(row: Row): boolean {
  return row.status === "Pending";
}

/**
 * Green is done, amber wants a human, grey is inert, red went wrong — the same reading as the
 * trail-import badges.
 */
export function statusTone(status?: string | null): "ok" | "busy" | "warn" | "bad" | "muted" {
  switch (status) {
    case "Sent":
      return "ok";
    case "Pending":
    case "Sending":
      return "busy";
    case "Failed":
      return "bad";
    case "Cancelled":
      return "muted";
    default:
      return "warn";
  }
}

/**
 * What the row is waiting for, in words.
 *
 * A Pending row that also carries a LastError has been tried before — that combination is not
 * a contradiction, it is the shape a retried or backing-off mail has, and saying so is the
 * difference between an operator reading the page correctly and filing a bug.
 */
export function describeNextAttempt(
  row: { status?: string | null; nextAttemptAt?: string | null; attempts?: number | null },
  now: Date = new Date(),
): string {
  if (row.status !== "Pending") return "";

  if (!row.nextAttemptAt) return "Waiting to be sent.";

  const due = new Date(row.nextAttemptAt);
  if (Number.isNaN(due.getTime())) return "Waiting to be sent.";

  const attempts = row.attempts ?? 0;

  if (due.getTime() <= now.getTime()) {
    return attempts > 0 ? `Queued for retry (${attempts} failed so far).` : "Waiting to be sent.";
  }

  const minutes = Math.max(1, Math.ceil((due.getTime() - now.getTime()) / 60000));

  return `Backing off — next attempt in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * What a purge is about to do, spelled out before it is irreversible.
 *
 * It names the statuses THIS action spares as well as the one it deletes, because the question
 * an operator actually has at this dialog is "will this lose my failed mail?".
 *
 * And then it says what the automatic sweep does anyway, which is the half that would otherwise
 * mislead. "Failed mail is never touched" was true when this button was the only thing that
 * deleted anything; MailOutboxRetentionService now deletes settled mail on its own clock, and
 * an operator reading the old sentence at an irreversible dialog would draw the wrong
 * conclusion about what is being kept for them.
 */
export function describePurge(olderThanDays: number, sentCount: number): string {
  const days = `${olderThanDays} day${olderThanDays === 1 ? "" : "s"}`;

  return (
    `Permanently deletes sent mail older than ${days}, and nothing else — ` +
    `pending, sending, failed and cancelled mail is left alone by this action. ` +
    `There ${sentCount === 1 ? "is" : "are"} ${sentCount} sent mail${sentCount === 1 ? "" : "s"} in total. ` +
    `Mail is deleted automatically once it is past its retention period; this is for clearing it sooner.`
  );
}

/** Whether the cutoff the operator typed is one the API will accept. */
export function isValidPurgeCutoff(olderThanDays: number): boolean {
  return Number.isInteger(olderThanDays) && olderThanDays >= 1 && olderThanDays <= 3650;
}
