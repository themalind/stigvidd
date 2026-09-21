// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Media;

namespace Core.Interfaces.Repositories;

public interface IMediaRepository
{
    Task<RepositoryResult<MediaLibraryPage>> GetMediaPagedAsync(MediaLibraryQuery query, CancellationToken ctoken);

    // keep-comment: caps the result at limit + 1 so the caller can tell "exactly at the cap" from "over it" without a second count
    Task<RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>> GetMatchingAsync(
        MediaFilter filter, int limit, CancellationToken ctoken);

    Task<RepositoryResult> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken);

    // Only matches TrailImages/FacilityImages; a trail symbol identifier is never returned.
    Task<RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>> GetByIdentifiersAsync(
        IReadOnlyCollection<string> identifiers, CancellationToken ctoken);
}

public record MediaLookupProjection(string Identifier, string OwnerType, string ImageUrl);

public record MediaItemProjection(
    // keep-comment: the sort tiebreak, and the per-source cap key. It is the row's int Id, not its Identifier, so that pushing the ordering into SQL later stays safe: a string tiebreak would then be compared under the database collation on one side and Ordinal on the other, and the two disagree on a GUID's hyphens under en_US.utf8
    int SourceId,
    string Identifier,
    string ImageUrl,
    string? AltText,
    string? Caption,
    int Width,
    int Height,
    long SizeBytes,
    DateTime CreatedAt,
    string OwnerType,
    string? OwnerIdentifier,
    string? OwnerName);

public record MediaLibraryPage(
    IReadOnlyCollection<MediaItemProjection> Items,
    int Page,
    bool HasMore,
    int TotalCount,
    int ReprocessableCount,
    long TotalSizeBytes);
