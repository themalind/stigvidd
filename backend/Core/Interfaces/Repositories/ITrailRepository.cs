using System.Linq.Expressions;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces.Repositories;

public interface ITrailRepository
{
    Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetTrailByIdentifierAsync<T>(string identifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<string>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsWithBasicInfoAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>> GetAllTrailMarkersAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>> GetPopularTrailOverviewsAsync(double? userLatitude, double? userLongitude, CancellationToken ctoken);
    Task<RepositoryResult<Trail>> AddTrailAsync(Trail trail, CancellationToken ctoken);
}
