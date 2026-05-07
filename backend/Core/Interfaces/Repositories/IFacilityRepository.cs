using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IFacilityRepository
{
    Task<RepositoryResult<Facility>> CreateFacilityAsync(Facility facility, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetAllAsync(CancellationToken ctoken);
    Task<RepositoryResult<Facility>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<Facility>> UpdateAsync(Facility facility, CancellationToken ctoken);
    Task<RepositoryResult> DeleteAsync(Facility facility, CancellationToken ctoken);
}
