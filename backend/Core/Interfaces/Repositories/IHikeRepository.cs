using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IHikeRepository
{
    Task<RepositoryResult<Hike>> CreateHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult<Hike>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetHikesAsync<T>(string? createdBy, Expression<Func<Hike, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeSharesByUserIdAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken);
}
