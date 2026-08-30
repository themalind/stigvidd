// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.TrailImport;

// An uploaded file and how far it has got. Counts are only filled in once the analysis
// has run, so a session still being analysed reports nulls rather than zeroes.
public class TrailImportSessionResponse
{
    public required int Id { get; set; }
    public required string Identifier { get; set; }
    public required string Source { get; set; }
    public required string FileName { get; set; }
    public required string FileHash { get; set; }
    public long FileSizeBytes { get; set; }
    public required string Status { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? AnalyzedAt { get; set; }
    public DateTime? AppliedAt { get; set; }
    public int FeatureCount { get; set; }
    public string? ErrorMessage { get; set; }
    public TrailImportCountsResponse? Counts { get; set; }

    // What applying wrote, for a session that has been applied. Null for every other
    // status, so a session in review cannot be mistaken for one that is done.
    public TrailImportApplyResponse? Applied { get; set; }

    // Earlier sessions built from a byte-identical file. Empty is the normal case.
    public IReadOnlyCollection<string>? DuplicateOf { get; set; }

    public static TrailImportSessionResponse Create(
        int id,
        string identifier,
        string source,
        string fileName,
        string fileHash,
        long fileSizeBytes,
        string status,
        string? uploadedBy,
        DateTime createdAt,
        DateTime? analyzedAt,
        DateTime? appliedAt,
        int featureCount,
        string? errorMessage,
        TrailImportCountsResponse? counts,
        TrailImportApplyResponse? applied)
    {
        return new TrailImportSessionResponse
        {
            Id = id,
            Identifier = identifier,
            Source = source,
            FileName = fileName,
            FileHash = fileHash,
            FileSizeBytes = fileSizeBytes,
            Status = status,
            UploadedBy = uploadedBy,
            CreatedAt = createdAt,
            AnalyzedAt = analyzedAt,
            AppliedAt = appliedAt,
            FeatureCount = featureCount,
            ErrorMessage = errorMessage,
            Counts = counts,
            Applied = applied
        };
    }
}
