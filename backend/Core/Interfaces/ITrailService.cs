using WebDataContracts.ResponseModels;
using WebDataContracts.ViewModels;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<IReadOnlyCollection<TrailDTO?>> GetTrailsAsync(CancellationToken ctoken);
    Task<TrailDTO?> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<IReadOnlyCollection<TrailOverviewViewModel?>> GetPopularTrailOverviewsAsync(CancellationToken ctoken);

}

