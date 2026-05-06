namespace WebDataContracts.ResponseModels.Facility;

public class FacilityResponse
{
    public required string Identifier { get; set; }
    public string Name { get; set; } = null!;
    public required int FacilityType { get; set; }
    public bool IsAccessible { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }

    public static FacilityResponse Create(string identifier, string name, int facilityType, bool isAccessible, decimal latitude, decimal longitude)
    {
        return new FacilityResponse
        {
            Identifier = identifier,
            Name = name,
            FacilityType = facilityType,
            IsAccessible = isAccessible,
            Latitude = latitude,
            Longitude = longitude
        };
    }
}
