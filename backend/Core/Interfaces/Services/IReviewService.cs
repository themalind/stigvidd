using Microsoft.AspNetCore.Http;
using WebDataContracts.ResponseModels.Review;

namespace Core.Interfaces.Services;

public interface IReviewService
{
    Task<Result<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, int page, int limit, CancellationToken ctoken);
    Task<Result<ReviewResponse?>> AddReviewAsync(string UserIdentifier, string trailIdentifier, string? trailReview, decimal rating, IFormFileCollection? imageUrls, CancellationToken ctoken);
    Task<Result> DeleteReviewAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken);

}
