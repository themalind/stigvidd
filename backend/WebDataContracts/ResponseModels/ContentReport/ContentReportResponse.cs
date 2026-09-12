// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

public class ContentReportResponse
{
    public required string Identifier { get; set; }
    public required string ContentType { get; set; }
    public required string ContentIdentifier { get; set; }
    public required string Reason { get; set; }
    public string? ReporterNote { get; set; }
    public required string Status { get; set; }

    // What the report did to the content, which is not the same as its status: a report can
    // be queued without hiding anything.
    public required string HideOutcome { get; set; }
    public DateTime CreatedAt { get; set; }

    public static ContentReportResponse Create(
        string identifier,
        string contentType,
        string contentIdentifier,
        string reason,
        string? reporterNote,
        string status,
        string hideOutcome,
        DateTime createdAt)
    {
        return new ContentReportResponse
        {
            Identifier = identifier,
            ContentType = contentType,
            ContentIdentifier = contentIdentifier,
            Reason = reason,
            ReporterNote = reporterNote,
            Status = status,
            HideOutcome = hideOutcome,
            CreatedAt = createdAt
        };
    }
}
