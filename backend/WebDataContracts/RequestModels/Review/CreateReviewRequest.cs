namespace WebDataContracts.RequestModels.Review;

public class CreateReviewRequest
{
    public decimal Rating { get; set; }
    public string? TrailReview { get; set; }
    public required string TrailIdentifier { get; set; }
}
