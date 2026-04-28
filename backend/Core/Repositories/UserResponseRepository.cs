using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Repositories;

public class UserResponseRepository : IUserResponseRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IFirebaseAuthRepository _firebaseAuthRepository;

    public UserResponseRepository(IDbContextFactory<StigViddDbContext> context, IFirebaseAuthRepository firebaseAuthRepository)
    {
        _context = context;
        _firebaseAuthRepository = firebaseAuthRepository;
    }

    public async Task<RepositoryResult<UserResponse>> GetUserByFirebaseUidAsync(string firebaseUid, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .AsNoTracking()
            .Where(u => u.FirebaseUid == firebaseUid)
            .Select(u => UserResponse.Create(u.Identifier, u.NickName, u.Email, null, null))
            .FirstOrDefaultAsync(ctoken);

        return user is null
            ? RepositoryResult<UserResponse>.NotFound()
            : RepositoryResult<UserResponse>.Success(user);
    }

    public async Task<RepositoryResult<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var userId = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == identifier)
            .Select(u => (int?)u.Id)
            .FirstOrDefaultAsync(ctoken);

        return userId is null
            ? RepositoryResult<int>.NotFound()
            : RepositoryResult<int>.Success(userId.Value);
    }

    public async Task<RepositoryResult<UserResponse>> GetUserByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == identifier)
            .Select(u => UserResponse.Create(u.Identifier, u.NickName, u.Email, null, null))
            .FirstOrDefaultAsync(ctoken);

        return user is null
            ? RepositoryResult<UserResponse>.NotFound()
            : RepositoryResult<UserResponse>.Success(user);
    }

    public async Task<RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .AsNoTracking()
            .Include(u => u.MyFavorites!)
                .ThenInclude(t => t.Reviews)
            .Include(u => u.MyFavorites!)
                .ThenInclude(t => t.TrailImages)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        IReadOnlyCollection<UserFavoritesTrailResponse> result = (user?.MyFavorites ?? [])
            .Select(trail => UserFavoritesTrailResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Description,
                trail.Reviews?.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
                trail.TrailImages?.Select(ti => TrailImageResponse.Create(ti.Identifier, ti.ImageUrl)).Take(1).ToList()))
            .OrderBy(t => t.Name)
            .ToList();

        return RepositoryResult<IReadOnlyCollection<UserFavoritesTrailResponse>>.Success(result);
    }

    public async Task<RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .AsNoTracking()
            .Include(u => u.MyWishList!)
                .ThenInclude(t => t.Reviews)
            .Include(u => u.MyWishList!)
                .ThenInclude(t => t.TrailImages)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        IReadOnlyCollection<UserWishlistTrailResponse> result = (user?.MyWishList ?? [])
            .Select(trail => UserWishlistTrailResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Description,
                trail.Reviews?.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
                trail.TrailImages?.Select(ti => TrailImageResponse.Create(ti.Identifier, ti.ImageUrl)).Take(1).ToList()))
            .OrderBy(t => t.Name)
            .ToList();

        return RepositoryResult<IReadOnlyCollection<UserWishlistTrailResponse>>.Success(result);
    }

    public async Task<RepositoryResult<User>> CreateUserAsync(User user, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Users.Add(user);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult<User>.Success(user);
    }

    public async Task<RepositoryResult<UserFavoritesTrailResponse>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(u => u.MyFavorites)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
            return RepositoryResult<UserFavoritesTrailResponse>.NotFound();

        var trail = await context.Trails
            .Include(t => t.TrailImages)
            .Include(t => t.Reviews)
            .FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

        if (trail is null)
            return RepositoryResult<UserFavoritesTrailResponse>.NotFound();

        user.MyFavorites ??= [];

        if (user.MyFavorites.Any(f => f.Identifier == trailIdentifier))
            return RepositoryResult<UserFavoritesTrailResponse>.Conflict();

        user.MyFavorites.Add(trail);

        try
        {
            await context.SaveChangesAsync(ctoken);
        }
        catch (DbUpdateException)
        {
            return RepositoryResult<UserFavoritesTrailResponse>.Conflict();
        }

        return RepositoryResult<UserFavoritesTrailResponse>.Success(UserFavoritesTrailResponse.Create(
            trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.Description,
            trail.Reviews!.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
            trail.TrailImages!.Select(ti => TrailImageResponse.Create(ti.Identifier, ti.ImageUrl)).Take(1).ToList()));
    }

    public async Task<RepositoryResult<UserWishlistTrailResponse>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(u => u.MyWishList)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
            return RepositoryResult<UserWishlistTrailResponse>.NotFound();

        var trail = await context.Trails
            .Include(t => t.TrailImages)
            .Include(t => t.Reviews)
            .FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

        if (trail is null)
            return RepositoryResult<UserWishlistTrailResponse>.NotFound();

        user.MyWishList ??= [];

        if (user.MyWishList.Any(t => t.Identifier == trailIdentifier))
            return RepositoryResult<UserWishlistTrailResponse>.Conflict();

        user.MyWishList.Add(trail);

        try
        {
            await context.SaveChangesAsync(ctoken);
        }
        catch (DbUpdateException)
        {
            return RepositoryResult<UserWishlistTrailResponse>.Conflict();
        }

        return RepositoryResult<UserWishlistTrailResponse>.Success(UserWishlistTrailResponse.Create(
            trail.Identifier,
            trail.Name,
            trail.TrailLength,
            trail.Description,
            trail.Reviews!.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
            trail.TrailImages!.Select(ti => TrailImageResponse.Create(ti.Identifier, ti.ImageUrl)).Take(1).ToList()));
    }

    public async Task<RepositoryResult> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(u => u.MyFavorites)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null || !(user.MyFavorites?.Any() ?? false))
            return RepositoryResult.NotFound();

        var trail = user.MyFavorites.FirstOrDefault(t => t.Identifier == trailIdentifier);

        if (trail is null)
            return RepositoryResult.NotFound();

        user.MyFavorites.Remove(trail);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }

    public async Task<RepositoryResult> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(u => u.MyWishList)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null || !(user.MyWishList?.Any() ?? false))
            return RepositoryResult.NotFound();

        var trail = user.MyWishList.FirstOrDefault(t => t.Identifier == trailIdentifier);

        if (trail is null)
            return RepositoryResult.NotFound();

        user.MyWishList.Remove(trail);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult.Success();
    }

    public async Task<RepositoryResult> DeleteUserAsync(string identifier, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Identifier == identifier, ctoken);

        if (user is null)
            return RepositoryResult.NotFound();

        // Wrap in a transaction so the DB deletion is rolled back if Firebase deletion fails.
        // Both deletions must succeed together — a partial delete would leave the systems out of sync.
        using var transaction = await context.Database.BeginTransactionAsync(ctoken);

        context.Users.Remove(user);
        await context.SaveChangesAsync(ctoken);

        await _firebaseAuthRepository.DeleteUserAsync(user.FirebaseUid, ctoken);

        await transaction.CommitAsync(ctoken);

        return RepositoryResult.Success();
    }
}
