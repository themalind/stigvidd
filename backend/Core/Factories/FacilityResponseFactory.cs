using Core.Common;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Factories;

// Add missing properties
public class FacilityResponseFactory
{
    // A coordinate-less facility reports 0/0 rather than null. That predates the geometry
    // column and clients rely on it, so GetValueOrDefault stays. The marker endpoint filters
    // those facilities out anyway (FacilityRepository.GetAllAsync).
    public FacilityResponse Create(Facility facility)
    {
        return FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            GeoPointFactory.ToLatitude(facility.Coordinates).GetValueOrDefault(),
            GeoPointFactory.ToLongitude(facility.Coordinates).GetValueOrDefault(),
            facility.Location,
            facility.Description,
            facility.Url
        );
    }

    public IReadOnlyCollection<FacilityResponse> Create(IReadOnlyCollection<Facility> facilities)
    {
        return facilities.Select(facility => FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            GeoPointFactory.ToLatitude(facility.Coordinates).GetValueOrDefault(),
            GeoPointFactory.ToLongitude(facility.Coordinates).GetValueOrDefault(),
            facility.Location,
            facility.Description,
            facility.Url
        )).ToList();
    }
}
