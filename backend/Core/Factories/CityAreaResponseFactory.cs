using Core.Services;
using WebDataContracts.ResponseModels.CityArea;

namespace Core.Factories;

public class CityAreaResponseFactory
{
    public CityAreaResponse Create(CityAreaProjection cityArea)
    {
        var facilities = cityArea.Facilities
            .Select(facility => CityAreaFacilityResponse.Create(
                facility.Identifier,
                facility.Name,
                facility.FacilityType,
                facility.IsAccessible,
                facility.Location,
                facility.Description,
                facility.Url))
            .ToList();

        var trails = cityArea.Trails
            .Select(trail => CityAreaTrailReferenceResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Classification,
                trail.Description))
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
