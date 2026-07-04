using Infrastructure.Data.Entities;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Interfaces.Services;

public interface IHikeService
{
    Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifer, CancellationToken ctoken);
    Task<Result<HikeResponse>> GetHikeByIdentifierAsync(string hikeIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken);
    Task<Result> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken);
    Task<Result<HikeResponse>> UpdateHikeAsync(string hikeIdentifier, string userIdentifier, string? name, string? description, string? gettingThere, string? parkingInfo, CancellationToken ctoken);
    Task<Result> SoftDeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken);
    Task<Result> DeleteHikeSharesByUserIdAsync(int userId, CancellationToken ctoken);
    Task<Result> DeleteHikesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken);
}