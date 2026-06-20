using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface ITrailRepository
{
    Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetTrailByIdentifierAsync<T>(string identifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetTrailsByIdentifiersAsync<T>(IReadOnlyCollection<string> identifiers, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<string>> GetCoordinatesByTrailIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailsWithBasicInfoAsync<T>(Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllTrailMarkersAsync<T>(Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetPopularTrailOverviewsAsync<T>(double? userLatitude, double? userLongitude, Expression<Func<Trail, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<Trail>> AddTrailAsync(Trail trail, CancellationToken ctoken);
    Task<RepositoryResult<Trail>> UpdateTrailAsync(Trail trail, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailImage>>> AddTrailImagesAsync(int trailId, IReadOnlyCollection<TrailImage> images, CancellationToken ctoken);
    Task<RepositoryResult> DeleteTrailImageAsync(string imageIdentifier, CancellationToken ctoken);
}
