namespace WebDataContracts.ResponseModels.Facility;

public class FacilityResponse
{
    public required string Identifier { get; set; }
    public string Name { get; set; } = null!;
    public required int FacilityType { get; set; }
    public bool IsAccessible { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }

    public static FacilityResponse Create(
        string identifier, 
        string name, 
        int facilityType, 
        bool isAccessible, 
        decimal? latitude, 
        decimal? longitude, 
        string? location, 
        string? description, 
        string? url)
    {
        return new FacilityResponse
        {
            Identifier = identifier,
            Name = name,
            FacilityType = facilityType,
            IsAccessible = isAccessible,
            Latitude = latitude,
            Longitude = longitude,
            Location = location,
            Description = description,
            Url = url
        };
    }
}
