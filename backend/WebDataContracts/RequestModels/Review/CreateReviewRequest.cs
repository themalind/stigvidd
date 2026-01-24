namespace WebDataContracts.RequestModels.Review;

public class CreateReviewRequest
{
    public float Grade { get; set; }
    public string? TrailReview { get; set; }
    public required string TrailIdentifier { get; set; }
}
