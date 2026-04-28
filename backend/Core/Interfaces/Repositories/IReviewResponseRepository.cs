using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;

namespace Core.Interfaces.Repositories;

public interface IReviewResponseRepository
{
    Task<RepositoryResult<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, int page, int limit, CancellationToken ctoken);
    Task<RepositoryResult<Review>> GetReviewByIdentifierAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken);
    Task<RepositoryResult<Review>> AddReviewAsync(Review review, CancellationToken ctoken);
    Task<RepositoryResult> DeleteReviewAsync(Review review, CancellationToken ctoken);
}
