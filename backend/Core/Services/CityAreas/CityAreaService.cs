// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using NetTopologySuite.Geometries;
using WebDataContracts.RequestModels.CityArea;
using WebDataContracts.ResponseModels.CityArea;

namespace Core.Services.CityAreas;

public class CityAreaService : ICityAreaService
{
    private readonly ICityAreaRepository _cityAreaRepository;
    private readonly CityAreaResponseFactory _cityAreaResponseFactory;

    public CityAreaService(ICityAreaRepository cityAreaRepository, CityAreaResponseFactory cityAreaResponseFactory)
    {
        _cityAreaRepository = cityAreaRepository;
        _cityAreaResponseFactory = cityAreaResponseFactory;
    }

    public async Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(double? latitude, double? longitude, CancellationToken ctoken)
    {
        var user = latitude is double lat && longitude is double lon ? new Coordinate(lon, lat) : null;
        // keep-comment: the boundary is only read to measure distance, so it is not loaded without a position
        var result = await _cityAreaRepository.GetAllAsync(Projection(withBoundary: user is not null, withPaths: false), ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<CityAreaResponse>>(new Message(500, "An error occurred while retrieving city areas."));

        return Result.Ok<IReadOnlyCollection<CityAreaResponse>>(
            [.. CityAreaRanking.Order(result.Value, user)
                .Select(ranked => _cityAreaResponseFactory.Create(ranked.Area, ranked.DistanceKm, includeShapes: false))]);
    }

    public async Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetByIdentifierAsync(
            identifier, Projection(withBoundary: true, withPaths: true), ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<CityAreaResponse>(new Message(500, "An error occurred while retrieving the city area."));

        if (!result.IsSuccess)
            return Result.Fail<CityAreaResponse>(new Message(404, $"No city area found with identifier: {identifier}"));

        return Result.Ok(_cityAreaResponseFactory.Create(result.Value, null, includeShapes: true));
    }

    public async Task<Result<IReadOnlyCollection<AdminCityAreaResponse>>> GetAllForAdminAsync(CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetAllForAdminAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<AdminCityAreaResponse>>(new Message(500, "An error occurred while retrieving city areas."));

        return Result.Ok(_cityAreaResponseFactory.CreateAdmin(result.Value));
    }

    public async Task<Result<AdminLinkSuggestionsResponse>> GetLinkSuggestionsAsync(CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetLinkSuggestionSourcesAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<AdminLinkSuggestionsResponse>(new Message(500, "An error occurred while retrieving unlinked facilities and trails."));

        var sources = result.Value;
        var facilities = sources.Facilities
            .Select(f => new SuggestedFacility(f, CityAreaSuggester.Suggest(f.Name, f.Latitude, f.Longitude, sources.Areas)))
            .ToList();
        var trails = sources.Trails
            .Select(t => new SuggestedTrail(t, CityAreaSuggester.Suggest(t.Name, t.Latitude, t.Longitude, sources.Areas)))
            .ToList();

        return Result.Ok(_cityAreaResponseFactory.CreateLinkSuggestions(facilities, trails));
    }

    public async Task<Result> SetFacilityLinkAsync(string areaIdentifier, string facilityIdentifier, bool linked, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.SetFacilityLinkAsync(areaIdentifier, facilityIdentifier, linked, ctoken);

        return ToResult(result, $"No city area '{areaIdentifier}' or facility '{facilityIdentifier}' found.");
    }

    public async Task<Result> SetTrailLinkAsync(string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.SetTrailLinkAsync(areaIdentifier, trailIdentifier, linked, ctoken);

        return ToResult(result, $"No city area '{areaIdentifier}' or trail '{trailIdentifier}' found.");
    }

    public async Task<Result> RemoveFacilityExclusionAsync(string areaIdentifier, string facilityIdentifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.RemoveFacilityExclusionAsync(areaIdentifier, facilityIdentifier, ctoken);

        return ToResult(result, $"No city area '{areaIdentifier}' or facility '{facilityIdentifier}' found.");
    }

    public async Task<Result> RemoveTrailExclusionAsync(string areaIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.RemoveTrailExclusionAsync(areaIdentifier, trailIdentifier, ctoken);

        return ToResult(result, $"No city area '{areaIdentifier}' or trail '{trailIdentifier}' found.");
    }

    public async Task<Result> SaveBoundaryAsync(string areaIdentifier, SaveCityAreaBoundaryRequest request, CancellationToken ctoken)
    {
        var boundary = ValidBoundary(request);

        if (boundary is null)
            return Result.Fail(InvalidBoundary());

        var result = await _cityAreaRepository.SaveBoundaryAsync(areaIdentifier, boundary, ctoken);

        return ToResult(result, $"No city area found with identifier: {areaIdentifier}");
    }

    public async Task<Result<AdminCityAreaBoundaryPreviewResponse>> PreviewBoundaryAsync(string areaIdentifier, SaveCityAreaBoundaryRequest request, CancellationToken ctoken)
    {
        var boundary = ValidBoundary(request);

        if (boundary is null)
            return Result.Fail<AdminCityAreaBoundaryPreviewResponse>(InvalidBoundary());

        var result = await _cityAreaRepository.PreviewBoundaryAsync(areaIdentifier, boundary, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<AdminCityAreaBoundaryPreviewResponse>(new Message(404, $"No city area found with identifier: {areaIdentifier}"));

        if (!result.IsSuccess)
            return Result.Fail<AdminCityAreaBoundaryPreviewResponse>(new Message(500, "An error occurred while previewing the boundary."));

        return Result.Ok(_cityAreaResponseFactory.CreateBoundaryPreview(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<AdminCityAreaTrailPathResponse>>> GetTrailPathsAsync(string areaIdentifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetTrailPathsAsync(areaIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<IReadOnlyCollection<AdminCityAreaTrailPathResponse>>(new Message(404, $"No city area found with identifier: {areaIdentifier}"));

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<AdminCityAreaTrailPathResponse>>(new Message(500, "An error occurred while retrieving the area's trails."));

        return Result.Ok(_cityAreaResponseFactory.CreateTrailPaths(result.Value));
    }

    public async Task<Result<AdminCityAreaBoundaryResponse>> SuggestBoundaryAsync(string areaIdentifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetBoundarySuggestionSourcesAsync(areaIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<AdminCityAreaBoundaryResponse>(new Message(404, $"No city area found with identifier: {areaIdentifier}"));

        if (!result.IsSuccess)
            return Result.Fail<AdminCityAreaBoundaryResponse>(new Message(500, "An error occurred while suggesting a boundary."));

        var suggestion = CityAreaBoundarySuggester.Suggest(result.Value.Paths, result.Value.Points);

        if (suggestion is null)
        {
            return Result.Fail<AdminCityAreaBoundaryResponse>(
                new Message(404, "The city area has no linked trails or facilities with a position to suggest a boundary from.", "no_boundary_sources"));
        }

        return Result.Ok(_cityAreaResponseFactory.CreateBoundary(suggestion));
    }

    public async Task<Result> SetMunicipalityAsync(string areaIdentifier, SetCityAreaMunicipalityRequest request, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.SetMunicipalityAsync(areaIdentifier, request.MunicipalityIdentifier, ctoken);

        return ToResult(result, $"No city area {areaIdentifier} or municipality {request.MunicipalityIdentifier} found.");
    }

    public async Task<Result> RemoveBoundaryAsync(string areaIdentifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.SaveBoundaryAsync(areaIdentifier, null, ctoken);

        return ToResult(result, $"No city area found with identifier: {areaIdentifier}");
    }

    public async Task<Result<AdminCityAreaRecalculationResponse>> RecalculateAllAsync(CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.RecalculateAllAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<AdminCityAreaRecalculationResponse>(new Message(500, "Could not recalculate the city areas."));

        return Result.Ok(_cityAreaResponseFactory.CreateRecalculation(result.Value));
    }

    private static Expression<Func<CityArea, CityAreaProjection>> Projection(bool withBoundary, bool withPaths)
    {
        return area => new CityAreaProjection(
            area.Identifier,
            area.Name,
            area.Location,
            area.Description,
            area.ImageUrl,
            area.Url,
            area.Municipality != null ? area.Municipality.Name : null,
            withBoundary ? area.Boundary : null,
            area.Facilities!
                .Select(f => new CityAreaFacilityProjection(
                    f.Identifier, f.Name, (int)f.FacilityType, f.IsAccessible, f.Location, f.Description, f.Url, f.Coordinates)).ToList(),
            area.Trails!
                .Where(t => t.IsVerified)
                .Select(t => new CityAreaTrailProjection(
                    t.Identifier,
                    t.Name,
                    t.TrailLength,
                    t.Classification,
                    t.Description,
                    t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                    t.TrailImages!.Select(i => new CityAreaTrailImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault(),
                    withPaths ? t.GeoPath : null)).ToList());
    }

    private static Message InvalidBoundary()
    {
        return new Message(400, "The boundary crosses itself or overlaps its own parts. Redraw it.");
    }

    private static MultiPolygon? ValidBoundary(SaveCityAreaBoundaryRequest request)
    {
        var boundary = GeoPolygonSerializer.FromCoordinates(request.Coordinates);

        return boundary is { IsValid: true } ? boundary : null;
    }

    private static Result ToResult(RepositoryResult result, string notFoundMessage)
    {
        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, notFoundMessage));

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while updating the city area."));

        return Result.Ok();
    }
}
