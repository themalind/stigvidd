namespace WebDataContracts.ResponseModels.Review;

public class ReviewResponse
{
    public required string Identifier { get; set; }
    public string? TrailReview { get; set; }
    public decimal Rating { get; set; }
    public required string UserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public required string UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public IReadOnlyCollection<ReviewImageResponse>? ReviewImages { get; set; }

    public static ReviewResponse Create(
        string identifier,
        string? trailReview,
        decimal rating,
        string username,
        DateTime createdAt,
        string trailIdentifier,
        string userIdentifier,
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

