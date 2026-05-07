using System.Linq.Expressions;
using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IHikeRepository
{
    Task<RepositoryResult<Hike>> CreateHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult<Hike>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetHikesAsync<T>(string? createdBy, Expression<Func<Hike, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken);
}
