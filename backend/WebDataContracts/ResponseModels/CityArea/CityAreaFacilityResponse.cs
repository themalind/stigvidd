namespace WebDataContracts.ResponseModels.CityArea;

public class CityAreaFacilityResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required int FacilityType { get; set; }
    public bool IsAccessible { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }

    public static CityAreaFacilityResponse Create(
        string identifier,
        string name,
        int facilityType,
        bool isAccessible,
        string? location,
        string? description,
        string? url)
    {
        return new CityAreaFacilityResponse
        {
            Identifier = identifier,
            Name = name,
            FacilityType = facilityType,
            IsAccessible = isAccessible,
            Location = location,
            Description = description,
            Url = url
        };
    }
}
