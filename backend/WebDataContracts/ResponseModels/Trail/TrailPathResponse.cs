namespace WebDataContracts.ResponseModels.Trail;

public class TrailPathResponse
{
    public required string Identifier { get; set; }
    public IReadOnlyCollection<LatLngPoint> Path { get; set; } = [];

    public static TrailPathResponse Create(string identifier, IReadOnlyCollection<LatLngPoint> path)
    {
        return new TrailPathResponse
        {
            Identifier = identifier,
            Path = path
        };
    }
}

public record LatLngPoint(double Latitude, double Longitude);

