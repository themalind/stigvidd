// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Infrastructure.Data.Entities;
using NetTopologySuite.Geometries;

namespace Core.Interfaces.Repositories.CityAreas;

public interface ICityAreaRepository
{
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllAsync<T>(Expression<Func<CityArea, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetByIdentifierAsync<T>(string identifier, Expression<Func<CityArea, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<AdminCityAreaProjection>>> GetAllForAdminAsync(CancellationToken ctoken);
    Task<RepositoryResult<LinkSuggestionSourcesProjection>> GetLinkSuggestionSourcesAsync(CancellationToken ctoken);
    // keep-comment: linking adds a manual link and lifts an exclusion; unlinking excludes what the boundary would bring back
    Task<RepositoryResult> SetFacilityLinkAsync(string areaIdentifier, string facilityIdentifier, bool linked, CancellationToken ctoken);
    Task<RepositoryResult> SetTrailLinkAsync(string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken);
    Task<RepositoryResult> RemoveFacilityExclusionAsync(string areaIdentifier, string facilityIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> RemoveTrailExclusionAsync(string areaIdentifier, string trailIdentifier, CancellationToken ctoken);
    // keep-comment: saves the boundary and recalculates the area's links in the same save; null removes it
    Task<RepositoryResult> SaveBoundaryAsync(string areaIdentifier, MultiPolygon? boundary, CancellationToken ctoken);
    // keep-comment: NotFound when either the area or the named municipality is missing; null clears it
    Task<RepositoryResult> SetMunicipalityAsync(string areaIdentifier, string? municipalityIdentifier, CancellationToken ctoken);
    // keep-comment: the area's linked trails (not contributions) and facilities that have a position
    Task<RepositoryResult<BoundarySuggestionSourcesProjection>> GetBoundarySuggestionSourcesAsync(string areaIdentifier, CancellationToken ctoken);

    // keep-comment: what saving this boundary would add and remove, by the same rule as SaveBoundaryAsync; saves nothing
    Task<RepositoryResult<BoundaryPreviewProjection>> PreviewBoundaryAsync(string areaIdentifier, MultiPolygon boundary, CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyCollection<AreaTrailPathProjection>>> GetTrailPathsAsync(string areaIdentifier, CancellationToken ctoken);

    Task<RepositoryResult> RecalculateTrailsAsync(IReadOnlyCollection<int> trailIds, CancellationToken ctoken);
    Task<RepositoryResult> RecalculateFacilitiesAsync(IReadOnlyCollection<int> facilityIds, CancellationToken ctoken);
    // keep-comment: every area with a boundary; returns how many
    Task<RepositoryResult<int>> RecalculateAllAsync(CancellationToken ctoken);
}
