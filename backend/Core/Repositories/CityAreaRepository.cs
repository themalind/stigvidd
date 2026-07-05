using System.Linq.Expressions;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class CityAreaRepository : ICityAreaRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<CityAreaRepository> _logger;

    public CityAreaRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<CityAreaRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public Task<RepositoryResult> CreateCityAreaAsync(CityArea cityArea, CancellationToken ctoken)
    {
        throw new NotImplementedException();
    }

       public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllAsync<T>(
        Expression<Func<CityArea, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var cityAreas = await context.CityAreas
                .AsNoTracking()
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(cityAreas);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetAllAsync -> Something went wrong when fetching all city areas.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetByIdentifierAsync<T>(
        string identifier, Expression<Func<CityArea, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var cityArea = await context.CityAreas
                .AsNoTracking()
                .Where(x => x.Identifier == identifier)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return cityArea is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(cityArea);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CityAreaRepository: GetByIdentifierAsync -> Something went wrong when fetching city area with identifier {identifier}", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public Task<RepositoryResult> UpdateCityAreaAsync(CityArea cityArea, CancellationToken ctoken)
    {
        throw new NotImplementedException();
    }

    public Task<RepositoryResult> DeleteCityAreaAsync(string identifier, CancellationToken ctoken)
    {
        throw new NotImplementedException();
    }
}
