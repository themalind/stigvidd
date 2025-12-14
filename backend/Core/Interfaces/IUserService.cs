using WebDataContracts.ResponseModels;

namespace Core.Interfaces;

public interface IUserService
{
    public Task<IReadOnlyCollection<TrailOverviewResponse>>? GetFavoritesByUserIdentifier(string userIdentifier, CancellationToken ctoken);
    public Task<IReadOnlyCollection<TrailOverviewResponse>> GetWishListByUserIdentifier(string userIdentifier, CancellationToken ctoken);
    public Task AddTrailToUserFavoritesList(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task AddTrailToUserWishList(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task RemoveTrailFromUserFavoritesList(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    public Task RemoveTrailFromUserWishList(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
}
