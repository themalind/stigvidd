// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.ContentReport;

public class ContentReportSummaryResponse
{
    public required string Identifier { get; set; }
    public required string ContentType { get; set; }
    public required string ContentIdentifier { get; set; }
    public required string? TrailIdentifier { get; set; }
    public required string Reason { get; set; }
    public required string? ReporterNote { get; set; }
    public required ReportStatus Status { get; set; }

    // Not the same as the status: a report can be queued without hiding anything, and the
    // queue has to say so or two rows with the same status look inconsistent in the app.
    public required string HideOutcome { get; set; }
    public required string? ReporterNickName { get; set; }
    public required string? AuthorNickName { get; set; }

    // Null once the account is deleted, which is also when there is nothing left to ban.
    public required string? AuthorIdentifier { get; set; }

    // Set while the account is banned, so the queue offers to lift it rather than ban it twice.
    public required DateTime? AuthorBannedAt { get; set; }
    public required string? ContentSnapshot { get; set; }

    // Set for a reported image only: the snapshot as an absolute URL. keep-comment: the snapshot itself is a relative path
    public required string? ContentImageUrl { get; set; }

    // False once retention or an account deletion has taken the content. Upholding is still
    // allowed, so the strike can land.
    public required bool ContentStillExists { get; set; }
    public required string? DecidedBy { get; set; }
    public required DateTime? DecidedAt { get; set; }
    public required string? DecisionNote { get; set; }
    public required DateTime CreatedAt { get; set; }

    public static ContentReportSummaryResponse Create(
        string identifier,
        string contentType,
        string contentIdentifier,
        string? trailIdentifier,
        string reason,
        string? reporterNote,
        ReportStatus status,
        string hideOutcome,
        string? reporterNickName,
        string? authorNickName,
        string? authorIdentifier,
        DateTime? authorBannedAt,
        string? contentSnapshot,
        string? contentImageUrl,
        bool contentStillExists,
        string? decidedBy,
        DateTime? decidedAt,
        string? decisionNote,
        DateTime createdAt)
    {
        return new ContentReportSummaryResponse
        {
            Identifier = identifier,
            ContentType = contentType,
            ContentIdentifier = contentIdentifier,
            TrailIdentifier = trailIdentifier,
            Reason = reason,
            ReporterNote = reporterNote,
            Status = status,
            HideOutcome = hideOutcome,
            ReporterNickName = reporterNickName,
            AuthorNickName = authorNickName,
            AuthorIdentifier = authorIdentifier,
            AuthorBannedAt = authorBannedAt,
            ContentSnapshot = contentSnapshot,
            ContentImageUrl = contentImageUrl,
            ContentStillExists = contentStillExists,
            DecidedBy = decidedBy,
            DecidedAt = decidedAt,
            DecisionNote = decisionNote,
            CreatedAt = createdAt
        };
    }
}
