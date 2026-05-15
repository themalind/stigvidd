using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IHikeShareRepository
{
    // ByUser = you are the owner who shared.
    Task<RepositoryResult<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken);
    Task<RepositoryResult> ShareHikeAsync(HikeShare hikeShare, CancellationToken ctoken);
}
