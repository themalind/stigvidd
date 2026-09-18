// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  adminMailOutboxCancel,
  adminMailOutboxGetAll,
  adminMailOutboxGetByIdentifier,
  adminMailOutboxGetCounts,
  adminMailOutboxPurge,
  adminMailOutboxRetry,
} from "./generated/admin-mail-outbox/admin-mail-outbox";
import type {
  MailOutboxCountsResponse,
  MailOutboxPurgeResponse,
  OutboxEmailDetailResponse,
  OutboxEmailSummaryResponse,
  PagedResultOfOutboxEmailSummaryResponse,
} from "./generated/model";

// Wrappers over the generated admin client, following the same convention as
// content-reports.ts. Auth and base URL come from the customFetch mutator.

export type OutboxMailSummary = OutboxEmailSummaryResponse;
export type OutboxMailDetail = OutboxEmailDetailResponse;
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

/** The one call that returns the rendered bodies. The list deliberately does not. */
export async function getOutboxMail(identifier: string): Promise<OutboxMailDetail> {
  return adminMailOutboxGetByIdentifier(identifier);
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
