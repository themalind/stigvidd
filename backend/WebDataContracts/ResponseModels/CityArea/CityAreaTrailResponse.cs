using WebDataContracts.ResponseModels.Trail;

namespace WebDataContracts.ResponseModels.CityArea;

public class CityAreaTrailResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public int Classification { get; set; }
    public string? Description { get; set; }
    public decimal AverageRating { get; set; }
    public TrailImageResponse? Image { get; set; }

    public static CityAreaTrailResponse Create(
        string identifier,
        string name,
        decimal trailLength,
        int classification,
        string? description,
        decimal averageRating,
        TrailImageResponse? image)
    {
        return new CityAreaTrailResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Classification = classification,
            Description = description,
            AverageRating = averageRating,
            Image = image
        };
    }
}
