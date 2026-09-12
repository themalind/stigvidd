// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// One table for every reportable type, because a report is a record of what was decided and
// deleting the content must not erase it. Upholding a report hard-deletes the content, so
// the snapshot below is all that is left of what a moderator judged.
public class ContentReport : BaseEntity
{
    // What was reported. ContentId is a plain int with no foreign key on purpose: the row
    // outlives the content it points at.
    public required ReportedContentType ContentType { get; set; }
    public required int ContentId { get; set; }
    public required string ContentIdentifier { get; set; }
    public int? TrailId { get; set; }
    public string? TrailIdentifier { get; set; }

    // The snapshot. Clipped to ContentReports:SnapshotMaxLength when the report is created,
    // and nulled when the author deletes their account.
    public string? ContentSnapshot { get; set; }
    public string? AuthorNickNameSnapshot { get; set; }
    public int? ContentAuthorUserId { get; set; }

    // Who reported it. A real foreign key with SetNull, so a deleted reporter leaves the
    // row behind without a dangling id.
    public int? ReporterUserId { get; set; }
    public required ReportReason Reason { get; set; }
    public string? ReporterNote { get; set; }

    // The decision.
    public ReportStatus Status { get; set; }
    public ReportHideOutcome HideOutcome { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecisionNote { get; set; }

    public User? Reporter { get; set; }
}
