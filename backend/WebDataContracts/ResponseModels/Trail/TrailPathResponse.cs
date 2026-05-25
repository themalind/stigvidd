namespace WebDataContracts.ResponseModels.Trail;

public class TrailPathResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public bool IsAccessible { get; set; }
    public decimal TrailLength { get; set; }
    public int Classification { get; set; }
    public IReadOnlyCollection<LatLngPoint> Path { get; set; } = [];

    public static TrailPathResponse Create(
        string identifier,
        string name, bool isAccessible,
        decimal trailLength,
        int classification,
        IReadOnlyCollection<LatLngPoint> path)
    {
        return new TrailPathResponse
        {
            Identifier = identifier,
            Name = name,
            IsAccessible = isAccessible,
            TrailLength = trailLength,
            Classification = classification,
            Path = path
        };
    }
}

public record LatLngPoint(double Latitude, double Longitude);

