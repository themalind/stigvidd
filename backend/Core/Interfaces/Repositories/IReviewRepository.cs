using System.Linq.Expressions;
using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IReviewRepository
{
    Task<RepositoryResult<PagedResult<T>>> GetReviewsByTrailIdentifierAsync<T>(string trailIdentifier, int page, int limit, Expression<Func<Review, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<Review>> GetReviewByIdentifierAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken);
    Task<RepositoryResult<Review>> AddReviewAsync(Review review, CancellationToken ctoken);
    Task<RepositoryResult> DeleteReviewAsync(Review review, CancellationToken ctoken);
    Task<RepositoryResult<bool>> HasUserReviewedTrailAsync(int trailId, int userId, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<string>>> GetReviewImageUrlsByUserIdAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult> AnonymizeReviewsByUserIdAsync(int userId, CancellationToken ctoken);
}
