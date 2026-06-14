using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Core.Repositories;

public class HikeShareRepository : IHikeShareRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContext;
    private readonly ILogger<HikeShareRepository> _logger;

    public HikeShareRepository(IDbContextFactory<StigViddDbContext> dbContext, ILogger<HikeShareRepository> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<RepositoryResult<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var count = await context.HikeShares
                .Include(hs => hs.Hike)
                .Where(hs => hs.Hike!.Identifier == hikeIdentifier && hs.Hike.CreatedBy == identifier)
                .CountAsync(ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: GetHikeShareCountAsync -> Something went wrong when fetching hike share count for hike {hikeIdentifier}.", hikeIdentifier);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> IsAlreadySharedAsync(int hikeId, int sharedWithId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);
            var exists = await context.HikeShares
                .AnyAsync(hs => hs.HikeId == hikeId && hs.SharedWithId == sharedWithId, ctoken);
            return RepositoryResult<bool>.Success(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: IsAlreadySharedAsync -> Something went wrong when checking if hike {hikeId} is already shared with user {sharedWithId}.", hikeId, sharedWithId);
            return RepositoryResult<bool>.Error();
        }
    }

    public async Task<RepositoryResult> ShareHikeAsync(HikeShare hikeShare, CancellationToken ctoken)
    {
        using var context = await _dbContext.CreateDbContextAsync(ctoken);
        try
        {
            await context.HikeShares.AddAsync(hikeShare, ctoken);
            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRepository: ShareHikeAsync -> Something went wrong when sharing hike with ID {hikeId} to user with ID {sharedWithId}.", hikeShare.HikeId, hikeShare.SharedWithId);
            return RepositoryResult.Error();
        }
    }
}
