namespace WebDataContracts.ResponseModels.Trail;

public class TrailImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }

    // Här behöver vi ändra så att vi kopplar ihop presentableUrl med imageUrl
    public static TrailImageResponse Create(string identifier, string imageUrl) 
    {
        return new TrailImageResponse
        {
            Identifier = identifier,
            ImageUrl = imageUrl, // ImageUrl = $"{presentableUrl}{imageUrl}"
        };
    }
}

