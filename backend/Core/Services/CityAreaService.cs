using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using WebDataContracts.ResponseModels.CityArea;

namespace Core.Services;

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
}

public record CityAreaProjection(
    string Identifier,
    string Name,
    string Location,
    string? Description,
    string? ImageUrl,
    string? Url,
    IReadOnlyCollection<CityAreaFacilityProjection> Facilities,
    IReadOnlyCollection<CityAreaTrailProjection> Trails);

public record CityAreaFacilityProjection(
    string Identifier,
    string Name,
    int FacilityType,
    bool IsAccessible,
    string? Location,
    string? Description,
    string? Url);

public record CityAreaTrailProjection(
    string Identifier,
    string Name,
    decimal TrailLength,
    int Classification,
    string? Description,
    decimal AverageRating,
    CityAreaTrailImageProjection? Image);

public record CityAreaTrailImageProjection(
    string Identifier,
    string ImageUrl);
