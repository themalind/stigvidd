// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// One uploaded source file and the run that analysed it. Holds the proposals a reviewer
// works through; nothing reaches Trails until the session is applied.
public class TrailImportSession : BaseEntity
{
    public required string Source { get; set; }

    public required string FileName { get; set; }
    public long FileSizeBytes { get; set; }

    // SHA-256 of the file, so an accidental re-upload of the same export is spotted.
    public required string FileHash { get; set; }

    // Path on the media volume; the file itself does not belong in a text column.
    public required string StoredPath { get; set; }

    public ImportSessionStatus Status { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime? AnalyzedAt { get; set; }
    public DateTime? AppliedAt { get; set; }
    public int FeatureCount { get; set; }
    public string? ErrorMessage { get; set; }

    // What the apply phase actually changed: created, updated, relinked, unpublished.
    public string? ApplyReport { get; set; }

    public ICollection<TrailImportProposal>? Proposals { get; set; }
}
