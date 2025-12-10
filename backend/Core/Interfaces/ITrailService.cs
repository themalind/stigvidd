using WebDataContracts.ResponseModels;
using WebDataContracts.ViewModels;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<IReadOnlyCollection<TrailResponse?>> GetTrailsAsync(CancellationToken ctoken);
    Task<TrailResponse?> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<IReadOnlyCollection<TrailOverviewViewModel?>> GetPopularTrailOverviewsAsync(CancellationToken ctoken);

}

