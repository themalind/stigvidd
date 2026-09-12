// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export type ReportedContentType = "Review" | "TrailObstacle";

export interface CreateContentReportRequest {
  contentType: ReportedContentType;
  contentIdentifier: string;
  reason: string;
  reporterNote?: string;
}

export interface ContentReport {
  identifier: string;
  contentType: string;
  contentIdentifier: string;
  reason: string;
  reporterNote?: string;
  status: string;
  // What the report did to the content, which is not the same as its status: a report can
  // be queued without hiding anything.
  hideOutcome: string;
  createdAt: string;
}
