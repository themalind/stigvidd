namespace WebDataContracts.ResponseModels;

public class TrailImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public required string TrailIdentifier { get; set; }

    public static TrailImageResponse Create(string identifier, string imageUrl, string trailIdentifier)
    {
        return new TrailImageResponse
        {
            Identifier = identifier,
            ImageUrl = imageUrl,
            TrailIdentifier = trailIdentifier
        };
    }
}

