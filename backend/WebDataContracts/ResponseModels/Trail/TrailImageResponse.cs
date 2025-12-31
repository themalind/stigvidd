namespace WebDataContracts.ResponseModels.Trail;

public class TrailImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }

    public static TrailImageResponse Create(string identifier, string imageUrl)
    {
        return new TrailImageResponse
        {
            Identifier = identifier,
            ImageUrl = imageUrl,
        };
    }
}

