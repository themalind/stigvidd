using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class HikeShareRecipientRepository : IHikeShareRecipientRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContext;
    private readonly ILogger<HikeShareRecipientRepository> _logger;

    public HikeShareRecipientRepository(IDbContextFactory<StigViddDbContext> dbContext, ILogger<HikeShareRecipientRepository> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetAllHikesSharedWithUserAsync<T>(string identifier, Expression<Func<HikeShare, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var hikes = await context.HikeShares
                .Include(hs => hs.Hike)
                .Where(hs => hs.SharedWith!.Identifier == identifier)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(hikes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRecipientRepository: GetAllHikesSharedWithUserAsync -> Something went wrong when fetching hikes shared with user {identifier}.", identifier);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> HasHikeSharedWithUserAsync(int userId, int hikeId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var hasHikeSharedWithUser = await context.HikeShares
                .AnyAsync(hs => hs.SharedWithId == userId && hs.HikeId == hikeId, ctoken);

            return RepositoryResult<bool>.Success(hasHikeSharedWithUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRecipientRepository: HasHikeSharedWithUserAsync -> Something went wrong when checking if hike with ID {hikeId} is shared with user with ID {userId}.", hikeId, userId);
            return RepositoryResult<bool>.Error();
        }
    }

    public async Task<RepositoryResult> ReshareSharedHikeAsync(HikeShare hikeShare, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            context.HikeShares.Add(hikeShare);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRecipientRepository: ReshareSharedHikeAsync -> Something went wrong when resharing hike with ID {hikeId} to user with ID {sharedWithId}.", hikeShare.HikeId, hikeShare.SharedWithId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteHikeShareAsync(int hikeId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var shares = await context.HikeShares
                .Where(hs => hs.SharedWithId == userId && hs.HikeId == hikeId)
                .ToListAsync(ctoken);

            context.HikeShares.RemoveRange(shares);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeShareRecipientRepository: DeleteHikeShareAsync -> Something went wrong when deleting hike share for hike with ID {hikeId} and user with ID {userId}.", hikeId, userId);
            return RepositoryResult.Error();
        }
    }
}
