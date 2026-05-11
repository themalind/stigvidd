using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class HikeRepository : IHikeRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<HikeRepository> _logger;

    public HikeRepository(IDbContextFactory<StigViddDbContext> context, ILogger<HikeRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<Hike>> CreateHikeAsync(Hike hike, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Hikes.Add(hike);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<Hike>.Success(hike);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: CreateHikeAsync -> Something went wrong when creating hike.");
            return RepositoryResult<Hike>.Error();
        }
    }

    public async Task<RepositoryResult<Hike>> GetHikeByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var hike = await context.Hikes
                .FirstOrDefaultAsync(h => h.Identifier == identifier, ctoken);

            return hike is null
                ? RepositoryResult<Hike>.NotFound()
                : RepositoryResult<Hike>.Success(hike);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetHikeByIdentifierAsync -> Something went wrong when fetching hike with identifier {identifier}.", identifier);
            return RepositoryResult<Hike>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetHikesAsync<T>(string? createdBy, Expression<Func<Hike, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var query = context.Hikes.AsQueryable();

            if (!string.IsNullOrWhiteSpace(createdBy))
                query = query.Where(h => h.CreatedBy == createdBy);

            var hikes = await query
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(hikes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetHikesAsync -> Something went wrong when fetching hikes for user {createdBy}.", createdBy);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Remove(hike);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: DeleteHikeAsync -> Something went wrong when deleting hike with identifier {identifier}.", hike.Identifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteHikesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var hikes = await context.Hikes
                .Where(h => h.CreatedBy == userIdentifier)
                .ToListAsync(ctoken);

            context.Hikes.RemoveRange(hikes);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: DeleteHikesByUserIdentifierAsync -> Something went wrong when deleting hikes for user {userIdentifier}.", userIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteHikeSharesByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            await context.HikeShares
                   .Where(hs => hs.SharedWithId == userId)
                   .ExecuteDeleteAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: DeleteHikeSharesByUserIdAsync -> Something went wrong when deleting hike shares for user with ID {userId}.", userId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken)
    {
        // Owner deletes account(has shared hikes) EF SetNull nulls Hike.UserId; hike, HikeShare rows, and images stay intact
        // Owner deletes account(no shared hikes) Fully delete: soft - delete hike, leave HikeImage rows + WebDAV files

        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var hikes = await context.Hikes
                .Where(h => h.UserId == userId)
                .ToListAsync(ctoken);

            var hikeIds = hikes.Select(h => h.Id).ToList();

            var sharedHikeIds = await context.HikeShares
                .Where(hs => hikeIds.Contains(hs.HikeId))
                .Select(hs => hs.HikeId)
                .ToHashSetAsync(ctoken);

            foreach (var hike in hikes)
            {
                if (!sharedHikeIds.Contains(hike.Id))
                {
                    hike.IsDeleted = true;
                    hike.DeletedAt = DateTime.UtcNow;
                }
            }

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: HandleUserHikesOnUserDeleteAsync -> Something went wrong when handling user hikes on user delete for user with ID {userId}.", userId);
            return RepositoryResult.Error();
        }
    }
}