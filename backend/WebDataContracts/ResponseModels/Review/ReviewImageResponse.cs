namespace WebDataContracts.ResponseModels.Review;

public class ReviewImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }

    public static ReviewImageResponse Create(
        string presentableUrl,
        string identifier,
        string imageUrl
        )
    {
        return new ReviewImageResponse
        {
            Identifier = identifier,
            ImageUrl = $"{presentableUrl}{imageUrl}",
        };
    }
}

