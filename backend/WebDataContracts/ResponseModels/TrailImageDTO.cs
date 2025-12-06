namespace WebDataContracts.ResponseModels;

public class TrailImageDTO
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public required string TrailIdentifier { get; set; }

    public static TrailImageDTO Create(string identifier, string imageUrl, string trailIdentifier)
    {
        return new TrailImageDTO
        {
            Identifier = identifier,
            ImageUrl = imageUrl,
            TrailIdentifier = trailIdentifier
        };
    }
}

