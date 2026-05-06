using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Factories;

public class FacilityResponseFactory
{
    public FacilityResponse Create(Facility facility)
    {
        return FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            facility.Latitude,
            facility.Longitude
        );
    }

    public IReadOnlyCollection<FacilityResponse> Create(IReadOnlyCollection<Facility> facilities)
    {
        return facilities.Select(facility => FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            facility.Latitude,
            facility.Longitude
        )).ToList();
    }
}
