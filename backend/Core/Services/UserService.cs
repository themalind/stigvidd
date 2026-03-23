using Core.Factories;
using Core.Interfaces;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Services;

public class UserService : IUserService
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<UserService> _logger;
    private readonly IFirebaseAuthService _firebaseAuthService;
    private readonly UserFavoritesResponseFactory _favoritesResponseFactory;
    private readonly UserWishlistResponseFactory _wishlistResponseFactory;
    private readonly UserResponseFactory _userResponseFactory;

    public UserService(IDbContextFactory<StigViddDbContext> context,
    ILogger<UserService> logger,
    IFirebaseAuthService firebaseAuthService,
    UserFavoritesResponseFactory favoritesFactory,
    UserWishlistResponseFactory wishlistFactory,
    UserResponseFactory userResponseFactory)
    {
        _context = context;
        _logger = logger;
        _firebaseAuthService = firebaseAuthService;
        _favoritesResponseFactory = favoritesFactory;
        _wishlistResponseFactory = wishlistFactory;
        _userResponseFactory = userResponseFactory;
    }

    public async Task<Result<UserResponse?>> GetUserByFirebaseUidAsync(string firebaseUid, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .AsNoTracking()
            .Where(user => user.FirebaseUid == firebaseUid)
            .Select(user => UserResponse.Create(
                user.Identifier,
                user.NickName,
                user.Email,
                null,
                null))
            .FirstOrDefaultAsync(ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with Firebase UID {firebaseUid} not found.", firebaseUid);
            return Result.Fail<UserResponse?>(new Message(404, $"User with Firebase UID {firebaseUid} not found."));
        }

        return Result.Ok<UserResponse?>(user);
    }

    public async Task<Result<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var userId = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == identifier)
            .Select(u => u.Id)
            .FirstOrDefaultAsync(ctoken);

        if (userId == 0)
        {
            _logger.LogWarning("User with identifier {identifier} not found.", identifier);
            return Result.Fail<int>(new Message(404, $"User with identifier {identifier} not found."));
        }

        return Result.Ok(userId);
    }

    public async Task<Result<IReadOnlyCollection<UserFavoritesTrailResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var favorites = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == userIdentifier)
            .SelectMany(u => u.MyFavorites!.Select(trail => UserFavoritesTrailResponse.Create(
                    trail.Identifier,
                    trail.Name,
                    trail.TrailLength,
                    trail.Description,
                    trail.Reviews!.Select(
                        rating => RatingResponse.Create(
                            rating.Identifier,
                            rating.Rating)).ToList(),
                   trail.TrailImages!.Select(
                       trailImage => TrailImageResponse.Create(
                           trailImage.Identifier,
                           trailImage.ImageUrl)).Take(1).ToList()
                   )))
            .ToListAsync(ctoken);

        var sorted = favorites.OrderBy(trail => trail.Name).ToList();

        return Result.Ok<IReadOnlyCollection<UserFavoritesTrailResponse?>>(sorted);
    }

    public async Task<Result<IReadOnlyCollection<UserWishlistTrailResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var wishlist = await context.Users
                .AsNoTracking()
                .Where(user => user.Identifier == userIdentifier)
                .SelectMany(user => user.MyWishList!.Select(trail => UserWishlistTrailResponse.Create(
                        trail.Identifier,
                        trail.Name,
                        trail.TrailLength,
                        trail.Description,
                        trail.Reviews!.Select(
                            reviews => RatingResponse.Create(
                                reviews.Identifier,
                                reviews.Rating)).ToList(),
                       trail.TrailImages!.Select(
                           trailImage => TrailImageResponse.Create(
                               trailImage.Identifier,
                               trailImage.ImageUrl)).Take(1).ToList()
                       )))
                .ToListAsync(ctoken);

        var sorted = wishlist.OrderBy(trail => trail.Name).ToList();

        return Result.Ok<IReadOnlyCollection<UserWishlistTrailResponse?>>(sorted);
    }

    public async Task<Result<UserResponse?>> CreateUserAsync(string email, string nickName, string firebaseUid, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var existingUser = await context.Users
            .FirstOrDefaultAsync(u => u.FirebaseUid == firebaseUid, ctoken);

        if (existingUser is not null)
        {
            _logger.LogWarning("User with identifier {firebaseUid} already exists.", firebaseUid);

            return Result.Fail<UserResponse?>(new Message(409, $"User with identifier {firebaseUid} already exists."));
        }

        var newUser = new User
        {
            FirebaseUid = firebaseUid,
            NickName = nickName,
            Email = email,
            MyFavorites = [],
            MyWishList = []
        };

        context.Users.Add(newUser);

        await context.SaveChangesAsync(ctoken);

        var userResponse = _userResponseFactory.Create(newUser);
        return Result.Ok<UserResponse?>(userResponse);
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

    public async Task<Result> DeleteUserAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .FirstOrDefaultAsync(user => user.Identifier == identifier, ctoken);

        if (user is null)
        {
            _logger.LogWarning("User with identifier {identifier} not found.", identifier);
            return Result.Fail(new Message(404, $"User with identifier {identifier} not found."));
        }

        // Wrap in a transaction so the DB deletion is rolled back if Firebase deletion fails.
        // Both deletions must succeed together — a partial delete would leave the systems out of sync.
        using var transaction = await context.Database.BeginTransactionAsync(ctoken);

        try
        {
            // Remove the user's solved votes first — NoAction FK prevents cascade from doing this automatically.
            var solvedVotes = await context.TrailObstacleSolvedVotes
                .Where(sv => sv.UserId == user.Id)
                .ToListAsync(ctoken);
            context.TrailObstacleSolvedVotes.RemoveRange(solvedVotes);

            // Stage the DB deletion. SaveChanges writes to the DB but the transaction is not committed yet.
            context.Users.Remove(user);
            await context.SaveChangesAsync(ctoken);

            // Delete the Firebase account via Admin SDK.
            // If this throws, the catch block rolls back the DB deletion.
            await _firebaseAuthService.DeleteUserAsync(user.FirebaseUid, ctoken);

            // Both deletions succeeded — commit the DB transaction.
            await transaction.CommitAsync(ctoken);
            return Result.Ok();
        }
        catch (Exception ex)
        {
            // Either the DB save or the Firebase deletion failed.
            // Rolling back ensures the StigVidd user is not left without a Firebase account.
            await transaction.RollbackAsync(ctoken);
            _logger.LogError(ex, "Error deleting user with identifier {identifier}", identifier);
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));
        }
    }
}
