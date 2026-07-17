using WebDataContracts.ResponseModels.Facility;

namespace WebDataContracts.ResponseModels.CityArea;

public class CityAreaResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Location { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? Url { get; set; }
    public required IReadOnlyCollection<FacilityResponse> Facilities { get; set; }
    public required IReadOnlyCollection<CityAreaTrailResponse> Trails { get; set; }

    public static CityAreaResponse Create(
        string identifier,
        string name,
        string location,
        string? description,
        string? imageUrl,
        string? url,
        IReadOnlyCollection<FacilityResponse> facilities,
        IReadOnlyCollection<CityAreaTrailResponse> trails)
    {
        return new CityAreaResponse
        {
            Identifier = identifier,
            Name = name,
            Location = location,
            Description = description,
            ImageUrl = imageUrl,
            Url = url,
            Facilities = facilities,
            Trails = trails
        };
    }
}
