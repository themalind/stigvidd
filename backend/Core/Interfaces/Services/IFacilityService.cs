using WebDataContracts.ResponseModels.Facility;

namespace Core.Interfaces.Services;

public interface IFacilityService
{
    Task<Result<FacilityResponse>> CreateFacilityAsync(string name, int facilityType, bool IsAccessible, decimal longitude, decimal latitude, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<FacilityResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<FacilityResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<FacilityResponse>> UpdateFacilityAsync(string facilityIdentifier, string? name, int? facilityType, bool? isAccessible, decimal? longitude, decimal? latitude, CancellationToken ctoken);
    Task<Result> DeleteAsync(string facilityIdentifier, CancellationToken ctoken);
}
