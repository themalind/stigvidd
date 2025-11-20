
using Infrastructure.Data.Entities;

namespace Core.Interfaces;

public interface ITrailService
{
    Task<IReadOnlyCollection<Trail?>> GetTrailsAsync(CancellationToken ctoken);
    Task<IReadOnlyCollection<Trail?>> GetPopularTrailsAsync(CancellationToken ctoken);
}

