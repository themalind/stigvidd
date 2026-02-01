namespace WebDataContracts.ResponseModels.Review;

public class PagedReviewResponse
{
    public required IReadOnlyCollection<ReviewResponse> Reviews { get; set; }
    public bool HasMore { get; set; }
    public int Page { get; set; }
    public int? Total { get; set; }
}
