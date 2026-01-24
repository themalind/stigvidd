using Microsoft.AspNetCore.Http;
using WebDataContracts.ResponseModels.Review;

namespace Core.Interfaces;

public interface IReviewService
{
    public Task<Result<IReadOnlyCollection<ReviewResponse?>>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, CancellationToken ctoken);
    public Task<Result<ReviewResponse?>> AddReviewAsync(string UserIdentifier, string trailIdentifier, string? trailReview, float grade, IFormFileCollection? imageUrls, CancellationToken ctoken);
    public Task<Result> DeleteReviewAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken);

}
