// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.ContentReports;

public record ReporterStatistic(
    int ReporterUserId,
    string? NickName,
    int Total,
    int Pending,
    int Dismissed,
    int Upheld,
    DateTime LastReportedAt);
