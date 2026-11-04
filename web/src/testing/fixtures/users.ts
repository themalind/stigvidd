// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AuthorStatisticResponse, ReporterStatisticResponse } from "@/api/generated/model";

export function reporterStatistic(overrides: Partial<ReporterStatisticResponse> = {}): ReporterStatisticResponse {
  return {
    nickName: "VandrarVennen",
    total: 4,
    pending: 1,
    dismissed: 1,
    upheld: 2,
    lastReportedAt: "2026-05-04T10:00:00Z",
    reportsAreWithheld: false,
    ...overrides,
  };
}

export function authorStatistic(overrides: Partial<AuthorStatisticResponse> = {}): AuthorStatisticResponse {
  return {
    identifier: "author-1",
    nickName: "SkogsGreven",
    strikes: 2,
    bannedAt: null,
    banCount: 0,
    ...overrides,
  };
}
