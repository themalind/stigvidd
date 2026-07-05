using System.Linq.Expressions;
using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface ICityAreaRepository
{
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllAsync<T>(Expression<Func<CityArea, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetByIdentifierAsync<T>(string identifier, Expression<Func<CityArea, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> CreateCityAreaAsync(CityArea cityArea, CancellationToken ctoken);
    Task<RepositoryResult> UpdateCityAreaAsync(CityArea cityArea, CancellationToken ctoken);
    Task<RepositoryResult> DeleteCityAreaAsync(string identifier, CancellationToken ctoken);
}
