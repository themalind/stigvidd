namespace WebDataContracts.ResponseModels;

public class TrailOverviewResponse
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public double TrailLength { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImagesResponse { get; set; }

    public static TrailOverviewResponse Create(
        string identifier,
        string? name,
        double trailLength,
        IEnumerable<TrailImageResponse>? trailImages)
    {
        return new TrailOverviewResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            TrailImagesResponse = trailImages?.ToList(),
        };
    }
}

