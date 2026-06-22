using WebDataContracts.ResponseModels.Friend;
using WebDataContracts.ResponseModels.User;

namespace Core.Interfaces.Services;

public interface IUserService
{
    Task<Result<UserResponse?>> GetUserBySubjectAsync(string subjectId, CancellationToken ctoken);
    Task<Result<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<UserResponse?>> GetUserByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<UserFavoritesTrailResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<UserWishlistTrailResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<SearchFriendResultResponse>>> FindUsersByNickNameAsync(string username, string currentUserIdentifier, CancellationToken ctoken);
    Task<Result<UserNameResponse>> CheckForUsername(string username, CancellationToken ctoken);
    Task<Result<UserResponse?>> CreateUserAsync(string email, string nickName, string subjectId, CancellationToken ctoken);
    Task<Result<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<Result<UserWishlistTrailResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<Result> DeleteUserAsync(string identifier, CancellationToken ctoken);
}
