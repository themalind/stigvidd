using WebDataContracts.ResponseModels.User;

namespace Core.Interfaces;

public interface IUserService
{
    public Task<Result<IReadOnlyCollection<UserTrailCollectionResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<IReadOnlyCollection<UserTrailCollectionResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<UserTrailCollectionResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result<UserTrailCollectionResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
}
