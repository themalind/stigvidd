// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Reporting.Models;

// keep-comment: nicknames are looked up by id and fall back to the snapshot, which goes stale on a rename and is nulled on account deletion
public record ContentReportSummary(
    string Identifier,
    ReportedContentType ContentType,
    string ContentIdentifier,
    string? TrailIdentifier,
    ReportReason Reason,
    string? ReporterNote,
    ReportStatus Status,
    ReportHideOutcome HideOutcome,
    string? ReporterNickName,
    string? AuthorNickName,
    // keep-comment: null once the author deletes their account, when there is nothing left to ban
    string? AuthorIdentifier,
    DateTime? AuthorBannedAt,
    string? ContentSnapshot,
    bool ContentStillExists,
    string? DecidedBy,
    DateTime? DecidedAt,
    string? DecisionNote,
    DateTime CreatedAt);
