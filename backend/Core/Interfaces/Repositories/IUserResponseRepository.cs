using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.User;

namespace Core.Interfaces.Repositories;

public interface IUserResponseRepository
{
    Task<RepositoryResult<UserResponse>> GetUserByFirebaseUidAsync(string firebaseUid, CancellationToken ctoken);
    Task<RepositoryResult<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<UserResponse>> GetUserByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    Task<RepositoryResult<User>> CreateUserAsync(User user, CancellationToken ctoken);
    Task<RepositoryResult<UserFavoritesTrailResponse>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<RepositoryResult<UserWishlistTrailResponse>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> DeleteUserAsync(string identifier, CancellationToken ctoken);
}
