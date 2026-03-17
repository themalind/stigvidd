using WebDataContracts.ResponseModels.User;

namespace Core.Interfaces;

public interface IUserService
{
    public Task<Result<IReadOnlyCollection<UserFavoritesTrailResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<IReadOnlyCollection<UserWishlistTrailResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result<UserWishlistTrailResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result<UserResponse?>> CreateUserAsync(string email, string nickName, string firebaseuid, CancellationToken ctoken);
    public Task<Result<UserResponse?>> GetUserByFirebaseUidAsync(string firebaseUid, CancellationToken ctoken);
    public Task<Result> DeleteUserAsync(string identifier, CancellationToken ctoken);
    public Task<Result<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken);
}
