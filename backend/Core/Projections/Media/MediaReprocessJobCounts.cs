// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.Media;

public record MediaReprocessJobCounts(
    string Identifier,
    string OptionsJson,
    int TotalCount,
    int PendingCount,
    int ProcessingCount,
    int SucceededCount,
    int FailedCount,
    int CancelledCount,
    DateTime CreatedAt,
    DateTime LastUpdatedAt);
