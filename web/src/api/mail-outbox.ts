// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  adminMailOutboxCancel,
  adminMailOutboxGetAll,
  adminMailOutboxGetBody,
  adminMailOutboxGetByIdentifier,
  adminMailOutboxGetCounts,
  adminMailOutboxPurge,
  adminMailOutboxRetry,
} from "./generated/admin-mail-outbox/admin-mail-outbox";
import type {
  MailOutboxCountsResponse,
  MailOutboxPurgeResponse,
  OutboxEmailBodyResponse,
  OutboxEmailDetailResponse,
  OutboxEmailSummaryResponse,
  PagedResultOfOutboxEmailSummaryResponse,
} from "./generated/model";

// Wrappers over the generated admin client, following the same convention as
// content-reports.ts. Auth and base URL come from the customFetch mutator.

export type OutboxMailSummary = OutboxEmailSummaryResponse;
export type OutboxMailDetail = OutboxEmailDetailResponse;
export type OutboxMailBody = OutboxEmailBodyResponse;
export type OutboxCounts = MailOutboxCountsResponse;
export type OutboxPurgeResult = MailOutboxPurgeResponse;

export type OutboxFilters = {
  status?: string;
  templateKey?: string;
  recipient?: string;
  page?: number;
  pageSize?: number;
};

export async function getOutboxMails(
  filters: OutboxFilters,
): Promise<PagedResultOfOutboxEmailSummaryResponse> {
  return adminMailOutboxGetAll(filters);
}

/** One mail, without its bodies. Neither the list nor this carries them any more. */
export async function getOutboxMail(identifier: string): Promise<OutboxMailDetail> {
  return adminMailOutboxGetByIdentifier(identifier);
}

/**
 * The one call that returns the rendered bodies, and the reason it is separate: a body carries
 * a nickname and, for reset-password, a live link, so the API logs who asked for it. Opening a
 * mail must therefore NOT call this — only an explicit reveal does.
 *
 * 404 once the body has been cleared under the retention policy; `redactedAt` on the summary
 * says so in advance, so the page can explain rather than ask and fail.
 */
export async function getOutboxMailBody(identifier: string): Promise<OutboxMailBody> {
  return adminMailOutboxGetBody(identifier);
}

export async function getOutboxCounts(): Promise<OutboxCounts> {
  return adminMailOutboxGetCounts();
}

/** Puts a failed or cancelled mail back in the queue, due now. 409 if it is being sent. */
export async function retryOutboxMail(identifier: string): Promise<OutboxMailDetail> {
  return adminMailOutboxRetry(identifier);
}

/** Stops a mail that is still waiting. 409 for anything already claimed or settled. */
export async function cancelOutboxMail(identifier: string): Promise<OutboxMailDetail> {
  return adminMailOutboxCancel(identifier);
}

/**
 * Deletes SENT mail older than the cutoff, and nothing else. Cannot be undone, which is why
 * the API refuses it without an explicit confirm.
 */
export async function purgeOutbox(olderThanDays: number): Promise<OutboxPurgeResult> {
  return adminMailOutboxPurge({ olderThanDays, confirm: true });
}
