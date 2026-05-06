namespace WebDataContracts.RequestModels.Facility;

public class CreateFacilityRequest
{
    public required string Name { get; init; }
    public required int FacilityType { get; init; }
    public required bool IsAccessible { get; init; }
    public required double Latitude { get; init; }
    public required double Longitude { get; init; }
}
