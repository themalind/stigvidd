using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Interfaces.Repositories;

public interface IHikeResponseRepository
{
    Task<RepositoryResult<Hike>> CreateHikeAsync(Hike hike, CancellationToken ctoken);
    Task<RepositoryResult<Hike>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(string? createdBy, CancellationToken ctoken);
    Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken);
}
