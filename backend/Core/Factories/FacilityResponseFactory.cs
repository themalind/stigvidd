using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Factories;

// Add missing properties
public class FacilityResponseFactory
{
    public FacilityResponse Create(Facility facility)
    {
        return FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            facility.Latitude.GetValueOrDefault(),
            facility.Longitude.GetValueOrDefault()
        );
    }

    public IReadOnlyCollection<FacilityResponse> Create(IReadOnlyCollection<Facility> facilities)
    {
        return facilities.Select(facility => FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            facility.Latitude.GetValueOrDefault(),
            facility.Longitude.GetValueOrDefault()
        )).ToList();
    }
}
