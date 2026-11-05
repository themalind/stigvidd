// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Projections.ContentReports;

// keep-comment: read past the moderation filter, so already hidden content can still be reported
public record ReportableContent(
    int ContentId,
    string ContentIdentifier,
    int? AuthorUserId,
    string? AuthorNickName,
    int? TrailId,
    string? TrailIdentifier,
    string? Snapshot,
    ModerationState ModerationState);
