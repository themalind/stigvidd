using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.User;

namespace Core.Services;

public class UserService : IUserService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<UserService> _logger;
    private readonly UserFavoritesResponseFactory _favoritesResponseFactory;
    private readonly UserWishlistResponseFactory _wishlistResponseFactory;

    public UserService(IDbContextFactory<StigViddDbContext> context,
    ILogger<UserService> logger,
    UserFavoritesResponseFactory favoritesFactory,
    UserWishlistResponseFactory wishlistFactory)
    {
        _context = context;
        _logger = logger;
        _favoritesResponseFactory = favoritesFactory;
        _wishlistResponseFactory = wishlistFactory;
    }

    public async Task<Result<IReadOnlyCollection<UserFavoritesTrailResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(mf => mf.MyFavorites!)
                .ThenInclude(ti => ti.TrailImages!)
            .Include(mf => mf.MyFavorites!)
                .ThenInclude(ri => ri.Reviews!)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<IReadOnlyCollection<UserFavoritesTrailResponse?>>(new Message(404, $"No user found with identifier {userIdentifier}"));
        }

        var favorites = _favoritesResponseFactory.Create(user.MyFavorites);

        return Result.Ok<IReadOnlyCollection<UserFavoritesTrailResponse?>>(favorites?.ToList() ?? []);
    }

    public async Task<Result<IReadOnlyCollection<UserWishlistTrailResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(wl => wl.MyWishList!)
                .ThenInclude(ti => ti.TrailImages!)
            .Include(wl => wl.MyWishList!)
                .ThenInclude(ri => ri.Reviews!)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<IReadOnlyCollection<UserWishlistTrailResponse?>>(new Message(404, $"No user found with identifier {userIdentifier}"));
        }

        var wishList = _wishlistResponseFactory.Create(user.MyWishList);

        return Result.Ok<IReadOnlyCollection<UserWishlistTrailResponse?>>(wishList?.ToList() ?? []);
    }

    public async Task<Result<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(mf => mf.MyFavorites)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier.ToString(), ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<UserFavoritesTrailResponse?>(new Message(404, $"User with identifier {userIdentifier} not found."));
        }

        var trail = await context.Trails
            .Include(ti => ti.TrailImages)
            .Include(r => r.Reviews)
            .FirstOrDefaultAsync(trail => trail.Identifier == trailIdentifier.ToString(), ctoken);

        if (trail is null)
        {
            _logger.LogWarning("Trail with identifier: {trailIdentifier} not found", trailIdentifier);

            return Result.Fail<UserFavoritesTrailResponse?>(new Message(404, $"Trail with identifier: {trailIdentifier} not found."));
        }

        user.MyFavorites ??= [];

        if (user.MyFavorites.Any(f => f.Identifier == trailIdentifier.ToString()))
        {
            _logger.LogDebug("Trail {trailIdentifier} already in user favorites", trailIdentifier);

            return Result.Fail<UserFavoritesTrailResponse?>(new Message(409, $"Trail {trailIdentifier} already in user favorites"));
        }

        user.MyFavorites.Add(trail);

        try
        {
            await context.SaveChangesAsync(ctoken);
        }
        catch (DbUpdateException)
        {

        }

        var response = _favoritesResponseFactory.Create(trail);

        return Result.Ok<UserFavoritesTrailResponse?>(response);
    }

    public async Task<Result<UserWishlistTrailResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(wl => wl.MyWishList)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail<UserWishlistTrailResponse?>(new Message(404, $"User with identifier {userIdentifier} not found."));
        }

        var trail = await context.Trails
            .Include(ti => ti.TrailImages)
            .Include(r => r.Reviews)
            .FirstOrDefaultAsync(trail => trail.Identifier == trailIdentifier, ctoken);

        if (trail is null)
        {
            _logger.LogWarning("Trail with identifier: {trailIdentifier} not found", trailIdentifier);

            return Result.Fail<UserWishlistTrailResponse?>(new Message(404, $"Trail with identifier: {trailIdentifier} not found"));
        }

        user.MyWishList ??= [];

        if (user.MyWishList.Any(trail => trail.Identifier == trailIdentifier))
        {
            _logger.LogDebug("Trail {trailIdentifier} already in user wishlist", trailIdentifier);

            return Result.Fail<UserWishlistTrailResponse?>(new Message(409, $"Trail {trailIdentifier} already in user wishlist"));
        }

        user.MyWishList.Add(trail);

        try
        {
            await context.SaveChangesAsync(ctoken);
        }
        catch (DbUpdateException)
        {

        }

        var response = _wishlistResponseFactory.Create(trail);

        return Result.Ok<UserWishlistTrailResponse?>(response);
    }

    public async Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(user => user.MyFavorites)
            .FirstOrDefaultAsync(user => user.Identifier == userIdentifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {userIdentifier} not found.", userIdentifier);

            return Result.Fail(new Message(404, $"No user found with identifier {userIdentifier}"));
        }

        if (!user.MyFavorites?.Any() ?? true)
        {
            _logger.LogWarning("User {userIdentifier} favorites list is empty", userIdentifier);

            return Result.Fail(new Message(404, "User has no favorites"));
        }

        if (user.MyFavorites is null)
        {
            _logger.LogWarning("User {userIdentifier} favorites list is null", userIdentifier);

            return Result.Fail(new Message(404, "User has no favorites"));
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

        if (!user.MyWishList?.Any() ?? true)
        {
            _logger.LogWarning("User {userIdentifier} wishlist is empty", userIdentifier);

            return Result.Fail(new Message(404, "User has no wishlist"));
        }

        if (user.MyWishList is null)
        {
            _logger.LogWarning("User {userIdentifier} wishlist is null", userIdentifier);
            return Result.Fail(new Message(404, "User has no wishlist"));
        }

        var trail = user.MyWishList.FirstOrDefault(trail => trail.Identifier == trailIdentifier);

        if (trail is null)
        {
            _logger.LogInformation("Trail {trailIdentifier} not in user wishlist", trailIdentifier);

            return Result.Fail(new Message(409, $"Trail {trailIdentifier} not in user wishlist"));
        }

        user.MyWishList.Remove(trail);
        await context.SaveChangesAsync(ctoken);

        return Result.Ok();
    }
}
