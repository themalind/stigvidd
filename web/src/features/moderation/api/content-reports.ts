// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  adminContentReportsDecide,
  adminContentReportsGetCounts,
  adminContentReportsGetReport,
  adminContentReportsGetReports,
} from "@/api/generated/admin-content-reports/admin-content-reports";
import type {
  ContentReportCountsResponse,
  ContentReportDetailResponse,
  ContentReportSummaryResponse,
  PagedResultOfContentReportSummaryResponse,
} from "@/api/generated/model";

// Wrappers over the generated admin client, following the same convention as
// trail-import.ts. Auth and base URL come from the customFetch mutator.

export type ReportSummary = ContentReportSummaryResponse;
export type ReportDetail = ContentReportDetailResponse;
export type ReportCounts = ContentReportCountsResponse;

export type QueueFilters = {
  status?: string;
  contentType?: string;
  hideOutcome?: string;
  page?: number;
  pageSize?: number;
};

export async function getReports(filters: QueueFilters): Promise<PagedResultOfContentReportSummaryResponse> {
  return adminContentReportsGetReports(filters);
}

export async function getReport(identifier: string): Promise<ReportDetail> {
  return adminContentReportsGetReport(identifier);
}

export async function getCounts(): Promise<ReportCounts> {
  return adminContentReportsGetCounts();
}

/** Dismiss puts the content back. Uphold deletes it permanently and records a strike. */
export async function decideReport(
  identifier: string,
  decision: "Dismiss" | "Uphold",
  decisionNote?: string,
): Promise<ReportDetail> {
  return adminContentReportsDecide(identifier, { decision, decisionNote });
}
