namespace WebDataContracts.ResponseModels;

public class ReviewImageDTO
{
    public required string Identifier { get; set; }
    public string? ImageUrl { get; set; }
    public int ReviewId { get; set; }

    public static ReviewImageDTO Create(
        string identifier,
        string? imageUrl,
        int reviewId
        )
    {
        return new ReviewImageDTO
        {
            Identifier = identifier,
            ImageUrl = imageUrl,
            ReviewId = reviewId,
        };
    }
}

