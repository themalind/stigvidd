namespace WebDataContracts.RequestModels.Facility;

public class CreateFacilityRequest
{
    public required string Name { get; init; }
    public required int FacilityType { get; init; }
    public required bool IsAccessible { get; init; }
    public required decimal? Latitude { get; init; }
    public required decimal? Longitude { get; init; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }
}
