// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
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

    public async Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetAllAsync(
            area => new CityAreaProjection(
                area.Identifier,
                area.Name,
                area.Location,
                area.Description,
                area.ImageUrl,
                area.Url,
                area.Facilities!
                    .Select(f => new CityAreaFacilityProjection(f.Identifier, f.Name, (int)f.FacilityType, f.IsAccessible, f.Location, f.Description, f.Url)).ToList(),
                area.Trails!
                    .Where(t => t.IsVerified)
                    .Select(t => new CityAreaTrailProjection(
                        t.Identifier,
                        t.Name,
                        t.TrailLength,
                        t.Classification,
                        t.Description,
                        t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                        t.TrailImages!.Select(i => new CityAreaTrailImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault())).ToList()),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<CityAreaResponse>>(new Message(500, "An error occurred while retrieving city areas."));

        return Result.Ok(_cityAreaResponseFactory.Create(result.Value));
    }

    public async Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.GetByIdentifierAsync(
            identifier,
            area => new CityAreaProjection(
                area.Identifier,
                area.Name,
                area.Location,
                area.Description,
                area.ImageUrl,
                area.Url,
                area.Facilities!
                    .Select(f => new CityAreaFacilityProjection(
                        f.Identifier, f.Name, (int)f.FacilityType, f.IsAccessible, f.Location, f.Description, f.Url)).ToList(),
                area.Trails!
                    .Where(t => t.IsVerified)
                    .Select(t => new CityAreaTrailProjection(
                        t.Identifier,
                        t.Name,
                        t.TrailLength,
                        t.Classification,
                        t.Description,
                        t.Reviews!.Any() ? t.Reviews!.Average(r => r.Rating) : 0m,
                        t.TrailImages!.Select(i => new CityAreaTrailImageProjection(i.Identifier, i.ImageUrl)).FirstOrDefault())).ToList()),
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<CityAreaResponse>(new Message(500, "An error occurred while retrieving the city area."));

        if (!result.IsSuccess)
            return Result.Fail<CityAreaResponse>(new Message(404, $"No city area found with identifier: {identifier}"));

        return Result.Ok(_cityAreaResponseFactory.Create(result.Value));
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

        return ToLinkResult(result, $"No city area '{areaIdentifier}' or facility '{facilityIdentifier}' found.");
    }

    public async Task<Result> SetTrailLinkAsync(string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken)
    {
        var result = await _cityAreaRepository.SetTrailLinkAsync(areaIdentifier, trailIdentifier, linked, ctoken);

        return ToLinkResult(result, $"No city area '{areaIdentifier}' or trail '{trailIdentifier}' found.");
    }

    private static Result ToLinkResult(RepositoryResult result, string notFoundMessage)
    {
        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, notFoundMessage));

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while updating the city area."));

        return Result.Ok();
    }
}
