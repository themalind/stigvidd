// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

public class ContentReportSummaryResponse
{
    public required string Identifier { get; set; }
    public required string ContentType { get; set; }
    public required string ContentIdentifier { get; set; }
    public string? TrailIdentifier { get; set; }
    public required string Reason { get; set; }
    public string? ReporterNote { get; set; }
    public required string Status { get; set; }

    // Not the same as the status: a report can be queued without hiding anything, and the
    // queue has to say so or two rows with the same status look inconsistent in the app.
    public required string HideOutcome { get; set; }
    public string? ReporterNickName { get; set; }
    public string? AuthorNickName { get; set; }
    public string? ContentSnapshot { get; set; }

    // False once retention or an account deletion has taken the content. Upholding is still
    // allowed, so the strike can land.
    public bool ContentStillExists { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecisionNote { get; set; }
    public DateTime CreatedAt { get; set; }

    public static ContentReportSummaryResponse Create(
        string identifier,
        string contentType,
        string contentIdentifier,
        string? trailIdentifier,
        string reason,
        string? reporterNote,
        string status,
        string hideOutcome,
        string? reporterNickName,
        string? authorNickName,
        string? contentSnapshot,
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
            ContentSnapshot = contentSnapshot,
            ContentStillExists = contentStillExists,
            DecidedBy = decidedBy,
            DecidedAt = decidedAt,
            DecisionNote = decisionNote,
            CreatedAt = createdAt
        };
    }
}
