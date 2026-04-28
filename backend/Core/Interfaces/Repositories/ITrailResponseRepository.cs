using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces.Repositories;

public interface ITrailResponseRepository
{
    Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<TrailResponse>> GetTrailByIdentifierWithoutCoordinatesAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<string>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>> GetPopularTrailOverviewsAsync(double? userLatitude, double? userLongitude, CancellationToken ctoken);
    Task<RepositoryResult<Trail>> AddTrailAsync(Trail trail, CancellationToken ctoken);
}
