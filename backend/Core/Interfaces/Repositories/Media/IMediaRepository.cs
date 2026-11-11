// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Media;

namespace Core.Interfaces.Repositories.Media;

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
