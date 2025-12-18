using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces;

public interface IUserService
{
    public Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
    public Task<Result<TrailOverviewResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result<TrailOverviewResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
}
