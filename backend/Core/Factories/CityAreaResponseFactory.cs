using Core.Services;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.CityArea;
using WebDataContracts.ResponseModels.Facility;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Factories;

public class CityAreaResponseFactory
{
    public string PresentableBaseUrl { get; }

    public CityAreaResponseFactory(IConfiguration configuration)
    {
        PresentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public CityAreaResponse Create(CityAreaProjection cityArea)
    {
        var facilities = cityArea.Facilities
            .Select(facility => FacilityResponse.Create(
                facility.Identifier,
                facility.Name,
                facility.FacilityType,
                facility.IsAccessible,
                null,
                null,
                facility.Location,
                facility.Description,
                facility.Url))
            .ToList();

        var trails = cityArea.Trails
            .Select(trail => CityAreaTrailResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Classification,
                trail.Description,
                trail.AverageRating,
                trail.Image != null
                    ? TrailImageResponse.Create(PresentableBaseUrl, trail.Image.Identifier, trail.Image.ImageUrl)
                    : null))
            .ToList();

        return CityAreaResponse.Create(
            cityArea.Identifier,
            cityArea.Name,
            cityArea.Location,
            cityArea.Description,
            cityArea.ImageUrl,
            cityArea.Url,
            facilities,
            trails);
    }

    public IReadOnlyCollection<CityAreaResponse> Create(IReadOnlyCollection<CityAreaProjection> cityAreas)
    {
        return cityAreas.Select(Create).ToList();
    }
}
