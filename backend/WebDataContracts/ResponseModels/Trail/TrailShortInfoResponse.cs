namespace WebDataContracts.ResponseModels.Trail;

public class TrailShortInfoResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required decimal TrailLength { get; set; }
    public bool Accessibility { get; set; }
    public int? Classification { get; set; }
    public required string City { get; set; }
    public decimal? StartLatitude { get; set; }
    public decimal? StartLongitude { get; set; }

    public static TrailShortInfoResponse Create(string identifier, string name, decimal trailLength,
        bool accessibility, int? classification, string city, decimal? startLatitude = null, decimal? startLongitude = null)
    {
        return new TrailShortInfoResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Accessibility = accessibility,
            Classification = classification,
            City = city,
            StartLatitude = startLatitude,
            StartLongitude = startLongitude
        };
    }
}