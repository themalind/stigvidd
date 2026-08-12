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

    public async Task<RepositoryResult<int>> GetHikeIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            var hikeId = await context.Hikes
                .Where(h => h.Identifier == identifier)
                .Select(h => h.Id)
                .FirstOrDefaultAsync(ctoken);

            return hikeId == 0
                ? RepositoryResult<int>.NotFound()
                : RepositoryResult<int>.Success(hikeId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetHikeIdByIdentifierAsync -> Something went wrong when fetching hike ID for identifier {identifier}.", identifier);
            return RepositoryResult<int>.Error();
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

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetHikesAsync<T>(int? userId, Expression<Func<Hike, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var query = context.Hikes.AsQueryable();

            if (userId.HasValue)
                query = query.Where(h => h.UserId == userId);

            var hikes = await query
                .OrderBy(h => h.Name)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(hikes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetHikesAsync -> Something went wrong when fetching hikes for user {userId}.", userId);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteHikeAsync(Hike hike, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            if (await HasSharesAsync(context, hike.Id, ctoken))
            {
                hike.UserId = null;
                context.Update(hike);
            }
            else
            {
                context.Hikes.Remove(hike);
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: DeleteHikeAsync -> Something went wrong when deleting hike with identifier {identifier}.", hike.Identifier);
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

    // The rule for which hikes an account deletion actually removes: the ones the user owns
    // that nobody holds a share of. A shared hike survives with Hike.UserId nulled, so its
    // images must survive too. Kept in one place because both the delete below and
    // GetDeletableHikeImageUrlsByUserIdAsync must agree on the exact same set.
    private static IQueryable<Hike> UserHikesWithoutShares(StigViddDbContext context, int userId) =>
        context.Hikes
            .Where(h => h.UserId == userId && !context.HikeShares.Any(hs => hs.HikeId == h.Id));

    // A hike with no owner and no shares is stored for nobody: the owner let it go (or deleted
    // their account) and the last recipient has now let it go too. Nothing keeps it alive, so
    // the row and its files must both go.
    private static IQueryable<Hike> OrphanedHikes(StigViddDbContext context) =>
        context.Hikes
            .Where(h => h.UserId == null && !context.HikeShares.Any(hs => hs.HikeId == h.Id));

    public async Task<RepositoryResult> HandleUserHikesOnUserDeleteAsync(int userId, CancellationToken ctoken)
    {
        // Owner deletes account(has shared hikes) EF SetNull nulls Hike.UserId; hike, HikeShare rows, and images stay intact
        // Owner deletes account(no shared hikes) Fully delete the hike here; HikeService deletes the image files from WebDAV

        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var hikesToDelete = await UserHikesWithoutShares(context, userId).ToListAsync(ctoken);

            context.Hikes.RemoveRange(hikesToDelete);

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: HandleUserHikesOnUserDeleteAsync -> Something went wrong when handling user hikes on user delete for user with ID {userId}.", userId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<Hike>> UpdateHikeAsync(Hike hike, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            context.Update(hike);
            await context.SaveChangesAsync(ctoken);
            return RepositoryResult<Hike>.Success(hike);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: UpdateHikeAsync -> Something went wrong when updating hike with identifier {identifier}.", hike.Identifier);
            return RepositoryResult<Hike>.Error();
        }
    }

    public async Task<RepositoryResult<IEnumerable<string>>> GetHikeImageUrlsByHikeIdAsync(int hikeId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var imageUrls = await context.HikeImages
                   .Where(hi => hi.HikeId == hikeId)
                   .Select(hi => hi.ImageUrl)
                   .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<string>>.Success(imageUrls);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetHikeImageUrlsByHikeIdAsync -> Something went wrong when fetching image URLs for hike with ID {hikeId}.", hikeId);
            return RepositoryResult<IEnumerable<string>>.Error();
        }
    }

    // Whether anyone holds a share of this hike. That single fact decides both branches of
    // DeleteHikeAsync and whether the caller may delete the image files, so it is asked here
    // rather than reimplemented by every caller.
    public async Task<RepositoryResult<bool>> HikeHasSharesAsync(int hikeId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            return RepositoryResult<bool>.Success(await HasSharesAsync(context, hikeId, ctoken));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: HikeHasSharesAsync -> Something went wrong when checking shares for hike with ID {hikeId}.", hikeId);
            return RepositoryResult<bool>.Error();
        }
    }

    private static Task<bool> HasSharesAsync(StigViddDbContext context, int hikeId, CancellationToken ctoken) =>
        context.HikeShares.AnyAsync(hs => hs.HikeId == hikeId, ctoken);

    // The image files belonging to the hikes HandleUserHikesOnUserDeleteAsync will remove.
    // Read this before the delete: afterwards the rows are gone and the URLs with them.
    public async Task<RepositoryResult<IEnumerable<string>>> GetDeletableHikeImageUrlsByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var deletableHikeIds = UserHikesWithoutShares(context, userId).Select(h => h.Id);

            var imageUrls = await context.HikeImages
                   .Where(hi => deletableHikeIds.Contains(hi.HikeId))
                   .Select(hi => hi.ImageUrl)
                   .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<string>>.Success(imageUrls);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetDeletableHikeImageUrlsByUserIdAsync -> Something went wrong when fetching deletable image URLs for user with ID {userId}.", userId);
            return RepositoryResult<IEnumerable<string>>.Error();
        }
    }

    // Read before DeleteOrphanedHikesAsync: afterwards the rows are gone and the URLs with them.
    public async Task<RepositoryResult<IEnumerable<string>>> GetOrphanedHikeImageUrlsAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var orphanedHikeIds = OrphanedHikes(context).Select(h => h.Id);

            var imageUrls = await context.HikeImages
                   .Where(hi => orphanedHikeIds.Contains(hi.HikeId))
                   .Select(hi => hi.ImageUrl)
                   .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<string>>.Success(imageUrls);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: GetOrphanedHikeImageUrlsAsync -> Something went wrong when fetching image URLs for orphaned hikes.");
            return RepositoryResult<IEnumerable<string>>.Error();
        }
    }

    // A sweep rather than a targeted delete: every path that drops a HikeShare calls this, and
    // sweeping costs one indexed query while also clearing rows earlier leaks left behind.
    public async Task<RepositoryResult> DeleteOrphanedHikesAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var orphanedHikes = await OrphanedHikes(context).ToListAsync(ctoken);

            context.Hikes.RemoveRange(orphanedHikes); // HikeImage rows follow by cascade

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: DeleteOrphanedHikesAsync -> Something went wrong when deleting orphaned hikes.");
            return RepositoryResult.Error();
        }
    }

    // Run after HandleUserHikesOnUserDeleteAsync, so the hikes still owned by this user are
    // exactly the shared ones that live on with their recipients. They keep the route, but not
    // the identifiers of someone who asked to be deleted. UserId itself is nulled by EF's
    // SetNull when the user row goes; CreatedBy and CreatedByNickName are denormalised copies
    // that nothing else clears.
    //
    // A single UPDATE rather than loaded entities: a Hike carries its whole GeoPath, and
    // fetching thousands of coordinates in order to null two strings is a round trip for nothing.
    public async Task<RepositoryResult> AnonymizeSharedHikesOnUserDeleteAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            await context.Hikes
                .Where(h => h.UserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(h => h.CreatedBy, (string?)null)
                    .SetProperty(h => h.CreatedByNickName, (string?)null), ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HikeRepository: AnonymizeSharedHikesOnUserDeleteAsync -> Something went wrong when anonymizing shared hikes for user with ID {userId}.", userId);
            return RepositoryResult.Error();
        }
    }
}