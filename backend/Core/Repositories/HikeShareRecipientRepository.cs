using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
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
                .Where(hs => hs.SharedWith!.Identifier == identifier && hs.Status == HikeShareStatus.Accepted)
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
                .AnyAsync(hs => hs.SharedWithId == userId && hs.HikeId == hikeId && hs.Status == HikeShareStatus.Accepted, ctoken);

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
            _logger.LogError(ex, 
                "HikeShareRecipientRepository: ReshareSharedHikeAsync -> Something went wrong when resharing hike with ID {hikeId} to user with ID {sharedWithId}.", 
                hikeShare.HikeId, hikeShare.SharedWithId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteHikeShareAsync(int hikeId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var shares = await context.HikeShares
                .Where(hs => hs.SharedWithId == userId && hs.HikeId == hikeId && hs.Status == HikeShareStatus.Accepted)
                .ToListAsync(ctoken);

            context.HikeShares.RemoveRange(shares);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "HikeShareRecipientRepository: DeleteHikeShareAsync -> Something went wrong when deleting hike share for hike with ID {hikeId} and user with ID {userId}.", 
                hikeId, userId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetPendingSharesForUserAsync<T>(int sharedWithId, Expression<Func<HikeShare, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var pendingShares = await context.HikeShares
                .AsNoTracking()
                .Include(hs => hs.Hike) // exclude coordinates?
                .Include(hs => hs.SharedBy)
                .Where(hs => hs.SharedWithId == sharedWithId && hs.Status == HikeShareStatus.Pending)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(pendingShares);
        }
        catch(Exception ex)
        {
            _logger.LogError(ex,
                "HikeShareRecipientRepository: GetPendingSharesForUserAsync -> Something went wrong when fetching pending shares for user with identifier {identifier}.",
                sharedWithId);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetPendingShareByIdentifierAsync<T>(int sharedWithId, string hikeIdentifier, Expression<Func<HikeShare, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var share = await context.HikeShares
                .AsNoTracking()
                .Include(hs => hs.Hike)
                .Include(hs => hs.SharedBy)
                .Where(hs => hs.SharedWithId == sharedWithId && hs.Hike!.Identifier == hikeIdentifier && hs.Status == HikeShareStatus.Pending)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            if (share == null)
                return RepositoryResult<T>.NotFound();

            return RepositoryResult<T>.Success(share);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "HikeShareRecipientRepository: GetPendingShareByIdentifierAsync -> Something went wrong when fetching pending share for hike {hikeIdentifier} and user with ID {sharedWithId}.",
                hikeIdentifier, sharedWithId);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult> AcceptHikeShareAsync(int hikeId, int sharedWithId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContext.CreateDbContextAsync(ctoken);

            var sharedRequest = await context.HikeShares
                .FirstOrDefaultAsync(hs => hs.HikeId == hikeId && hs.SharedWithId == sharedWithId && hs.Status == HikeShareStatus.Pending, ctoken);

            if (sharedRequest == null) 
                return RepositoryResult.NotFound();

            sharedRequest.Status = HikeShareStatus.Accepted; 
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex) 
        {
            _logger.LogError(ex,
                "HikeShareRecipientRepository: AcceptHikeShareAsync -> Something went wrong when accepting hike share for hike with ID {hikeId} and user with ID {userId}.", 
                hikeId, sharedWithId);
            return RepositoryResult.Error();
        }    
    }

    public async Task<RepositoryResult> RejectHikeShareAsync(int hikeId, int sharedWithId, CancellationToken ctoken)
    {
        try
        {
            using  var context = await _dbContext.CreateDbContextAsync(ctoken);

            var sharedRequest = await context.HikeShares
                .FirstOrDefaultAsync(hs => hs.HikeId == hikeId && hs.SharedWithId == sharedWithId && hs.Status == HikeShareStatus.Pending, ctoken);

            if (sharedRequest == null)
                return RepositoryResult.NotFound();

            context.HikeShares.Remove(sharedRequest);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch(Exception ex) 
        {
            _logger.LogError(ex,
                "HikeShareRecipientRepository: RejectHikeShareAsync -> Something went wrong when rejecting hike share for hike with ID {hikeId} and user with ID {userId}.", 
                hikeId, sharedWithId);
            return RepositoryResult.Error();
        }
    }
}
