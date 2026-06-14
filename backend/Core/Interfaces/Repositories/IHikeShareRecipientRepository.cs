using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IHikeShareRecipientRepository
{
    // WithUser = you are the recipient
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllHikesSharedWithUserAsync<T>(string identifier, Expression<Func<HikeShare, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<bool>> HasHikeSharedWithUserAsync(int userId, int hikeId, CancellationToken ctoken);
    Task<RepositoryResult> ReshareSharedHikeAsync(HikeShare hikeShare, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeShareAsync(int hikeId, int userId, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetPendingSharesForUserAsync<T>(int sharedWithId, Expression<Func<HikeShare, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetPendingShareByIdentifierAsync<T>(int sharedWithId, string hikeIdentifier, Expression<Func<HikeShare, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> AcceptHikeShareAsync(int hikeId, int sharedWithId, CancellationToken ctoken);
    Task<RepositoryResult> RejectHikeShareAsync(int hikeId, int sharedWithId, CancellationToken ctoken);
}
