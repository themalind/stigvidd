using WebDataContracts.ResponseModels;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<IReadOnlyCollection<TrailResponse?>> GetTrailsAsync(CancellationToken ctoken);
    Task<TrailResponse?> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<IReadOnlyCollection<TrailOverviewResponse?>> GetPopularTrailOverviewsAsync(CancellationToken ctoken);

}

