using WebDataContracts.ResponseModels.User;

namespace Core.Interfaces;

public interface IUserService
{
    public Task<Result<IReadOnlyCollection<UserFavoritesTrailCollectionResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<IReadOnlyCollection<UserWishlistTrailCollectionResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<UserFavoritesTrailCollectionResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result<UserWishlistTrailCollectionResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
}
