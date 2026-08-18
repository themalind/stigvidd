namespace WebDataContracts.ResponseModels.Review;

public class ReviewResponse
{
    public required string Identifier { get; set; }
    public string? TrailReview { get; set; }
    public decimal Rating { get; set; }
    // Both null once the author has deleted their account.
    public string? UserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public IReadOnlyCollection<ReviewImageResponse>? ReviewImages { get; set; }

    public static ReviewResponse Create(
        string identifier,
        string? trailReview,
        decimal rating,
        string? username,
        DateTime createdAt,
        string trailIdentifier,
        string? userIdentifier,
        IEnumerable<ReviewImageResponse>? reviewImages)
    {
        return new ReviewResponse
        {
            Identifier = identifier,
            TrailReview = trailReview,
            Rating = rating,
            UserName = username,
            CreatedAt = createdAt,
            TrailIdentifier = trailIdentifier,
            UserIdentifier = userIdentifier,
            ReviewImages = reviewImages?.ToList(),
        };
    }
}

