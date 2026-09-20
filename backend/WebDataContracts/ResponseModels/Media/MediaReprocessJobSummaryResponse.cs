// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Media;

/// <summary>One batch reprocess job, with its item counts but not the item list.</summary>
public class MediaReprocessJobSummaryResponse
{
    public required string Identifier { get; set; }

    /// <summary>"Pending" | "Processing" | "Completed" -- computed from the item counts.</summary>
    public required string Status { get; set; }

    public int TotalCount { get; set; }
    public int PendingCount { get; set; }
    public int ProcessingCount { get; set; }
    public int SucceededCount { get; set; }
    public int FailedCount { get; set; }
    public int CancelledCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }

    public static MediaReprocessJobSummaryResponse Create(
        string identifier,
        int totalCount,
        int pendingCount,
        int processingCount,
        int succeededCount,
        int failedCount,
        int cancelledCount,
        DateTime createdAt,
        DateTime lastUpdatedAt)
    {
        var status = processingCount > 0
            ? "Processing"
            : pendingCount > 0
                ? "Pending"
                : "Completed";

        return new MediaReprocessJobSummaryResponse
        {
            Identifier = identifier,
            Status = status,
            TotalCount = totalCount,
            PendingCount = pendingCount,
            ProcessingCount = processingCount,
            SucceededCount = succeededCount,
            FailedCount = failedCount,
            CancelledCount = cancelledCount,
            CreatedAt = createdAt,
            LastUpdatedAt = lastUpdatedAt,
        };
    }
}
