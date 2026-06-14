using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IUserRepository
{
    Task<RepositoryResult<T>> GetUserByFirebaseUidAsync<T>(string firebaseUid, Expression<Func<User, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetUserByIdentifierAsync<T>(string identifier, Expression<Func<User, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetUserByNickNameAsync<T>(string nickName, Expression<Func<User, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> CheckUserNicknameAvaliability(string nickname, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetFavoritesByUserIdentifierAsync<T>(string userIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetWishListByUserIdentifierAsync<T>(string userIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<bool>> CheckForUsername(string username, CancellationToken ctoken);
    Task<RepositoryResult<User>> CreateUserAsync(User user, CancellationToken ctoken);
    Task<RepositoryResult<T>> AddTrailToUserFavoritesListAsync<T>(string userIdentifier, string trailIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<T>> AddTrailToUserWishListAsync<T>(string userIdentifier, string trailIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> DeleteUserAsync(string identifier, CancellationToken ctoken);
}
