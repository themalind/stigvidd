// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories;

public record MediaReprocessJobCounts(
    string Identifier,
    string OptionsJson,
    int TotalCount,
    int PendingCount,
    int ProcessingCount,
    int SucceededCount,
    int FailedCount,
    int CancelledCount,
    DateTime CreatedAt,
    DateTime LastUpdatedAt);

public record MediaReprocessItemDetail(
    string Identifier,
    string MediaIdentifier,
    string OwnerType,
    MediaReprocessItemStatus Status,
    string? LastError,
    DateTime CreatedAt,
    DateTime LastUpdatedAt);

// keep-comment: rows share files (placeholders by the hundred), so a success reports how many rows moved and whether the old file may be deleted
public record MediaReprocessSuccess(int RowsRepointed, bool OldFileStillReferenced);

public interface IMediaReprocessRepository
{
    Task<RepositoryResult<MediaReprocessJob>> CreateJobAsync(
        string optionsJson,
        IReadOnlyCollection<(string MediaIdentifier, string OwnerType)> targets,
        CancellationToken ctoken);

    Task<RepositoryResult<MediaReprocessItem>> ClaimAsync(int itemId, CancellationToken ctoken);

    /// <summary>
    /// Moves every Trail/Facility image row that stored <paramref name="oldImageUrl"/> to the new
    /// file, settles this job's pending items for those rows, and reports whether anything else
    /// (a hike, review, city area or trail symbol) still points at the old file.
    /// </summary>
    Task<RepositoryResult<MediaReprocessSuccess>> MarkSucceededAsync(
        int itemId, string oldImageUrl, string newImageUrl, int width, int height, long sizeBytes, CancellationToken ctoken);

    Task<RepositoryResult> MarkFailedAsync(int itemId, string error, CancellationToken ctoken);

    Task<RepositoryResult<int>> ResetInterruptedAsync(CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyCollection<int>>> GetPendingItemIdsAsync(CancellationToken ctoken);

    Task<RepositoryResult<int>> CancelPendingItemsAsync(string jobIdentifier, CancellationToken ctoken);

    /// <summary>Moves a job's Failed items back to Pending and returns their ids for the queue.</summary>
    Task<RepositoryResult<IReadOnlyCollection<int>>> RetryFailedItemsAsync(string jobIdentifier, CancellationToken ctoken);

    Task<RepositoryResult<PagedResult<MediaReprocessJobCounts>>> GetJobsPagedAsync(
        int page, int pageSize, CancellationToken ctoken);

    Task<RepositoryResult<MediaReprocessJobCounts>> GetJobCountsAsync(string identifier, CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyCollection<MediaReprocessItemDetail>>> GetJobItemsAsync(
        string jobIdentifier, CancellationToken ctoken);

    Task<RepositoryResult<int>> PurgeSettledJobsBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken);
}
