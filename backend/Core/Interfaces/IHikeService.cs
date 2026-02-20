using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Interfaces;

public interface IHikeService
{
    public Task<Result<HikeResponse>> CreateHikeAsync(CreateHikeRequest request, string userIdentifer, CancellationToken ctoken);
    public Task<Result<HikeResponse>> GetHikeByIdentifierAsync(string hikeIdentifier, CancellationToken ctoken);
    public Task<Result<IReadOnlyCollection<HikeResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken);
    public Task<Result> DeleteHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken);
}