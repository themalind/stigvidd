namespace WebDataContracts.ResponseModels.CityArea;

public class CityAreaTrailReferenceResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public int Classification { get; set; }
    public string? Description { get; set; }

    public static CityAreaTrailReferenceResponse Create(
        string identifier,
        string name,
        decimal trailLength,
        int classification,
        string? description)
    {
        return new CityAreaTrailReferenceResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Classification = classification,
            Description = description
        };
    }
}
