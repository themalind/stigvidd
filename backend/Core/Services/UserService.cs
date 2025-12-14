using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels;

namespace Core.Services;

public class UserService(IDbContextFactory<StigViddDbContext> context, ILogger<UserService> logger) : IUserService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;
    private readonly ILogger<UserService> _logger = logger;

    public async Task<IReadOnlyCollection<TrailOverviewResponse>> GetFavoritesByUserIdentifier(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(mf => mf.MyFavorites!)
                .ThenInclude(ti => ti.TrailImages!)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            throw new InvalidOperationException($"No user found with identifier {userIdentifier}. User can not be null");
        }

        var favorites = user.MyFavorites?
            .Select(trail => TrailOverviewResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.TrailImages?
                    .Select(image => TrailImageResponse.Create(
                        image.Identifier,
                        image.ImageUrl))
                    .ToList()

            )).ToList();

        return favorites ?? [];
    }

    public async Task<IReadOnlyCollection<TrailOverviewResponse>> GetWishListByUserIdentifier(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(wl => wl.MyWishList!)
                .ThenInclude(ti => ti.TrailImages!)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            throw new KeyNotFoundException($"No user found with identifier {userIdentifier}");
        }

        var wishList = user.MyWishList?
            .Select(trail => TrailOverviewResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.TrailImages?
                    .Select(trailImage => TrailImageResponse.Create(
                        trailImage.Identifier,
                        trailImage.ImageUrl))
                    .ToList()

            )).ToList();

        return wishList ?? [];
    }

    public async Task AddTrailToUserFavoritesList(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(mf => mf.MyFavorites)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            throw new InvalidOperationException($"No user found with identifier {userIdentifier}. User can not be null");
        }

        var trail = await context.Trails.FirstOrDefaultAsync(trail => trail.Identifier == trailIdentifier, ctoken);

        if (trail is null)
        {
            _logger.LogWarning("Trail with identifier: {trailIdentifier} not found", trailIdentifier);

            throw new InvalidOperationException($"No trail found with identifier {trailIdentifier}. Trail can not be null");
        }

        user.MyFavorites ??= []; 

        if (user.MyFavorites.Any(f => f.Identifier == trailIdentifier))
        {
            _logger.LogDebug("Trail {trailIdentifier} already in user favorites", trailIdentifier);

            return;
        }

        user.MyFavorites.Add(trail);

        await context.SaveChangesAsync(ctoken);
    }

    public async Task AddTrailToUserWishList(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(wl => wl.MyWishList!)
                .ThenInclude(ti => ti.TrailImages)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            throw new InvalidOperationException($"No user found with identifier {userIdentifier}. User can not be null");
        }

        var trail = await context.Trails.FirstOrDefaultAsync(trail => trail.Identifier == trailIdentifier, ctoken);

        if (trail is null)
        {
            _logger.LogWarning("Trail with identifier: {trailIdentifier} not found", trailIdentifier);

            throw new InvalidOperationException($"No trail found with identifier {trailIdentifier}. Trail can not be null");
        }

        user.MyWishList ??= [];

        if (user.MyWishList.Any(trail => trail.Identifier == trailIdentifier))
        {
            _logger.LogDebug("Trail {trailIdentifier} already in user favorites", trailIdentifier);

            return;
        }

        user.MyWishList.Add(trail);

        await context.SaveChangesAsync(ctoken);
    }

    public async Task RemoveTrailFromUserFavoritesList(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(user => user.MyFavorites!)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            throw new KeyNotFoundException($"No user found with identifier {userIdentifier}");
        }

        if (user.MyFavorites is null)
        {
            _logger.LogWarning("User {userIdentifier} favorites list is null", userIdentifier);

            throw new InvalidOperationException("User favorites list is null");
        }

        var trail = user.MyFavorites.FirstOrDefault(t => t.Identifier == trailIdentifier);

        if (trail is null)
        {
            _logger.LogInformation("Trail {trailIdentifier} not in user favorites", trailIdentifier);
            return;
        }

        user.MyFavorites.Remove(trail);

        await context.SaveChangesAsync(ctoken);
    }

    public async Task RemoveTrailFromUserWishList(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(user => user.MyWishList)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            throw new KeyNotFoundException($"No user found with identifier {userIdentifier}");
        }

        if(user.MyWishList is null)
        {
            _logger.LogWarning("User {userIdentifier} favorites list is null", userIdentifier);

            throw new InvalidOperationException("User favorites list is null");
        }

        var trail = user.MyWishList.FirstOrDefault(trail => trail.Identifier == trailIdentifier);

        if (trail is null)
        {
            _logger.LogInformation("Trail {trailIdentifier} not in user favorites", trailIdentifier);
            return;
        }

        user.MyWishList.Remove(trail);

        await context.SaveChangesAsync(ctoken);
    }
}
