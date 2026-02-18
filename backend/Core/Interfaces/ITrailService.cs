using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<Result<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailOverviewsAsync(double? userLatitude, double? userLongitude, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken);
}

