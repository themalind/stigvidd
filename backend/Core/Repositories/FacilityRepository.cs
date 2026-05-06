using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class FacilityRepository : IFacilityRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<FacilityRepository> _logger;

    public FacilityRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<FacilityRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<Facility>> CreateFacilityAsync(Facility facility, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.Facilities.Add(facility);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Facility>.Success(facility);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: CreateFacilityAsync -> Something went wrong when creating facility.");
            return RepositoryResult<Facility>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetAllAsync(CancellationToken ctoken)
    {
        try
        {
            using var dbContext = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var facilities = await dbContext.Facilities.ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<Facility>>.Success(facilities);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: GetAllAsync -> Something went wrong when fetching all facilities.");
            return RepositoryResult<IReadOnlyCollection<Facility>>.Error();
        }
    }

    public async Task<RepositoryResult<Facility>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var facility = await context.Facilities
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Identifier == identifier, ctoken);

            return facility is null
             ? RepositoryResult<Facility>.NotFound()
             : RepositoryResult<Facility>.Success(facility);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: GetByIdentifierAsync -> Something went wrong when fetching facility with identifier {identifier}", identifier);
            return RepositoryResult<Facility>.Error();
        }
    }

    public async Task<RepositoryResult<Facility>> UpdateAsync(Facility facility, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            facility.LastUpdatedAt = DateTime.UtcNow;

            context.Facilities.Update(facility);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Facility>.Success(facility);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: UpdateAsync -> Could not update facility with identifier {identifier}", facility.Identifier);
            return RepositoryResult<Facility>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteAsync(Facility facility, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.Facilities.Remove(facility);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityRepository: DeleteAsync -> Something went wrong when deleting facility with identifier {identifier}.", facility.Identifier);
            return RepositoryResult.Error();
        }
    }
}
