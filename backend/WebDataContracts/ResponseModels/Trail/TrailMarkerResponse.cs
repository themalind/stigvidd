namespace WebDataContracts.ResponseModels.Trail;

public class TrailMarkerResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public bool IsAccessible { get; set; }
    public decimal? StartLatitude { get; set; }
    public decimal? StartLongitude { get; set; }

    public static TrailMarkerResponse Create(
        string identifier,
        string name,
        bool isAccessible,
        decimal? startLatitude,
        decimal? startLongitude)
    {
        return new TrailMarkerResponse
        {
            Identifier = identifier,
            Name = name,
            IsAccessible = isAccessible,
            StartLatitude = startLatitude,
            StartLongitude = startLongitude
        };
    }
}