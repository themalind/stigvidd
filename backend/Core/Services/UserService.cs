using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Services;

public class UserService(IDbContextFactory<StigViddDbContext> context, ILogger<UserService> logger) : IUserService
{
    private readonly IDbContextFactory<StigViddDbContext> _context = context;
    private readonly ILogger<UserService> _logger = logger;

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(mf => mf.MyFavorites!)
                .ThenInclude(ti => ti.TrailImages!)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<IReadOnlyCollection<TrailOverviewResponse?>>(new Message(404, $"No user found with identifier {userIdentifier}"));
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

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(favorites ?? []);
    }

    public async Task<Result<IReadOnlyCollection<TrailOverviewResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(wl => wl.MyWishList!)
                .ThenInclude(ti => ti.TrailImages!)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<IReadOnlyCollection<TrailOverviewResponse?>> (new Message(404, $"No user found with identifier {userIdentifier}"));
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

        return Result.Ok<IReadOnlyCollection<TrailOverviewResponse?>>(wishList ?? []);
    }

    public async Task<Result<TrailOverviewResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(mf => mf.MyFavorites)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier.ToString(), ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<TrailOverviewResponse?>(new Message(404, $"User with identifier {userIdentifier} not found."));
        }

        var trail = await context.Trails
            .Include(ti => ti.TrailImages)
            .FirstOrDefaultAsync(trail => trail.Identifier == trailIdentifier.ToString(), ctoken);

        if (trail is null)
        {
            _logger.LogWarning("Trail with identifier: {trailIdentifier} not found", trailIdentifier);

            return Result.Fail<TrailOverviewResponse?>(new Message(404, $"Trail with identifier: {trailIdentifier} not found."));
        }

        user.MyFavorites ??= [];

        if (user.MyFavorites.Any(f => f.Identifier == trailIdentifier.ToString()))
        {
            _logger.LogDebug("Trail {trailIdentifier} already in user favorites", trailIdentifier);

            return Result.Fail<TrailOverviewResponse?>(new Message(409, $"Trail {trailIdentifier} already in user favorites"));
        }

        user.MyFavorites.Add(trail);
        await context.SaveChangesAsync(ctoken);

        var response = TrailOverviewResponse.Create(
            trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.TrailImages?
                .Select(image => TrailImageResponse.Create(
                    image.Identifier,
                    image.ImageUrl))
                .ToList());

        return Result.Ok<TrailOverviewResponse?>(response);
    }

    public async Task<Result<TrailOverviewResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(wl => wl.MyWishList)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<TrailOverviewResponse?>(new Message(404, $"User with identifier {userIdentifier} not found."));
        }

        var trail = await context.Trails
            .Include(ti => ti.TrailImages)
            .FirstOrDefaultAsync(trail => trail.Identifier == trailIdentifier, ctoken);

        if (trail is null)
        {
            _logger.LogWarning("Trail with identifier: {trailIdentifier} not found", trailIdentifier);

            return Result.Fail<TrailOverviewResponse?>(new Message(404, $"Trail with identifier: {trailIdentifier} not found"));
        }

        user.MyWishList ??= [];

        if (user.MyWishList.Any(trail => trail.Identifier == trailIdentifier))
        {
            _logger.LogDebug("Trail {trailIdentifier} already in user wishlist", trailIdentifier);

            return Result.Fail<TrailOverviewResponse?>(new Message(409, $"Trail {trailIdentifier} already in user wishlist"));
        }

        user.MyWishList.Add(trail);

        await context.SaveChangesAsync(ctoken);

        var response = TrailOverviewResponse.Create(
            trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.TrailImages?
                .Select(image => TrailImageResponse.Create(
                    image.Identifier,
                    image.ImageUrl))
                .ToList());

        return Result.Ok<TrailOverviewResponse?>(response);
    }

    public async Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(user => user.MyFavorites!)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail(new Message(404, $"No user found with identifier {userIdentifier}"));
        }

        if (user.MyFavorites is null)
        {
            _logger.LogWarning("User {userIdentifier} favorites list is null", userIdentifier);

            return Result.Fail(new Message(404, "User favorites list is null"));
        }

        var trail = user.MyFavorites.FirstOrDefault(t => t.Identifier == trailIdentifier);

        if (trail is null)
        {
            _logger.LogInformation("Trail {trailIdentifier} not in user favorites", trailIdentifier);

            return Result.Fail(new Message(409, $"Trail {trailIdentifier} not in user favorites"));
        }

        user.MyFavorites.Remove(trail);
        await context.SaveChangesAsync(ctoken);

        return Result.Ok();
    }

    public async Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(user => user.MyWishList)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

           return Result.Fail(new Message(404, $"No user found with identifier {userIdentifier}"));
        }

        if (user.MyWishList is null)
        {
            _logger.LogWarning("User {userIdentifier} favorites list is null", userIdentifier);

            return Result.Fail(new Message(404, "User favorites list is null"));
        }

        var trail = user.MyWishList.FirstOrDefault(trail => trail.Identifier == trailIdentifier);

        if (trail is null)
        {
            _logger.LogInformation("Trail {trailIdentifier} not in user favorites", trailIdentifier);

            return Result.Fail(new Message(409, $"Trail {trailIdentifier} not in user wishlist"));
        }

        user.MyWishList.Remove(trail);
        await context.SaveChangesAsync(ctoken);

        return Result.Ok();
    }
}
