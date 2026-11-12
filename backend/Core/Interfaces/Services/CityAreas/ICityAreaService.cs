// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.CityArea;
using WebDataContracts.ResponseModels.CityArea;

namespace Core.Interfaces.Services.CityAreas;

public interface ICityAreaService
{
    // keep-comment: nearest first with a location, else most popular first
    Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(double? latitude, double? longitude, CancellationToken ctoken);
    Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<AdminCityAreaResponse>>> GetAllForAdminAsync(CancellationToken ctoken);
    Task<Result<AdminLinkSuggestionsResponse>> GetLinkSuggestionsAsync(CancellationToken ctoken);
    Task<Result> SetFacilityLinkAsync(string areaIdentifier, string facilityIdentifier, bool linked, CancellationToken ctoken);
    Task<Result> SetTrailLinkAsync(string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken);
    Task<Result> RemoveFacilityExclusionAsync(string areaIdentifier, string facilityIdentifier, CancellationToken ctoken);
    Task<Result> RemoveTrailExclusionAsync(string areaIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<Result> SaveBoundaryAsync(string areaIdentifier, SaveCityAreaBoundaryRequest request, CancellationToken ctoken);
    Task<Result<AdminCityAreaBoundaryPreviewResponse>> PreviewBoundaryAsync(string areaIdentifier, SaveCityAreaBoundaryRequest request, CancellationToken ctoken);

    Task<Result<IReadOnlyCollection<AdminCityAreaTrailPathResponse>>> GetTrailPathsAsync(string areaIdentifier, CancellationToken ctoken);

    Task<Result<AdminCityAreaBoundaryResponse>> SuggestBoundaryAsync(string areaIdentifier, CancellationToken ctoken);

    Task<Result> RemoveBoundaryAsync(string areaIdentifier, CancellationToken ctoken);
    Task<Result> SetMunicipalityAsync(string areaIdentifier, SetCityAreaMunicipalityRequest request, CancellationToken ctoken);
    Task<Result<AdminCityAreaRecalculationResponse>> RecalculateAllAsync(CancellationToken ctoken);
}
