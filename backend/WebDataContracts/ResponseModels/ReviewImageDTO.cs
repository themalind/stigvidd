namespace WebDataContracts.ResponseModels;

public class ReviewImageDTO
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public required string ReviewIdentifier { get; set; }

    public static ReviewImageDTO Create(
        string identifier,
        string imageUrl,
        string reviewIdentifier
        )
    {
        return new ReviewImageDTO
        {
            Identifier = identifier,
            ImageUrl = imageUrl,
            ReviewIdentifier = reviewIdentifier,
        };
    }
}

