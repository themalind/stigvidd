namespace WebDataContracts.RequestModels.Facility;

public class UpdateFacilityRequest
{
    public string? Name { get; set; }
    public int? FacilityType { get; set; }
    public bool? IsAccessible { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}
