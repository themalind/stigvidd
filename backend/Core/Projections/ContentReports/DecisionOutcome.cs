// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Enums;

namespace Core.Projections.ContentReports;

// keep-comment: the caller deletes DeletedImageUrls from WebDAV once the row is gone
public record DecisionOutcome(
    ReportStatus AppliedStatus,
    IReadOnlyCollection<string> DeletedImageUrls,
    int ReportsSettled,
    IReadOnlyList<PushMessage> Pushes);
