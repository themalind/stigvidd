using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IHikeRepository
{
    Task<RepositoryResult<Hike>> CreateHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult<Hike>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<int>> GetHikeIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetHikesAsync<T>(int? userId, Expression<Func<Hike, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<Hike>> UpdateHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeSharesByUserIdAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<string>>> GetOrphanedHikeImageUrlsAsync(CancellationToken ctoken);
    Task<RepositoryResult> DeleteOrphanedHikesAsync(CancellationToken ctoken);
    Task<RepositoryResult> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<string>>> GetHikeImageUrlsByHikeIdAsync(int hikeId, CancellationToken ctoken);
    Task<RepositoryResult<bool>> HikeHasSharesAsync(int hikeId, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<string>>> GetDeletableHikeImageUrlsByUserIdAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult> AnonymizeSharedHikesOnUserDeleteAsync(int userId, CancellationToken ctoken);
}
