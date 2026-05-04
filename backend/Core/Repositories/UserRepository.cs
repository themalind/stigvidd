using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Core.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IFirebaseAuthRepository _firebaseAuthRepository;

    public UserRepository(IDbContextFactory<StigViddDbContext> context, IFirebaseAuthRepository firebaseAuthRepository)
    {
        _context = context;
        _firebaseAuthRepository = firebaseAuthRepository;
    }

    public async Task<RepositoryResult<T>> GetUserByFirebaseUidAsync<T>(string firebaseUid, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var result = await context.Users
            .AsNoTracking()
            .Where(u => u.FirebaseUid == firebaseUid)
            .Select(selector)
            .FirstOrDefaultAsync(ctoken);

        return result is null
            ? RepositoryResult<T>.NotFound()
            : RepositoryResult<T>.Success(result);
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

    public async Task<RepositoryResult<T>> GetUserByIdentifierAsync<T>(string identifier, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var result = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == identifier)
            .Select(selector)
            .FirstOrDefaultAsync(ctoken);

        return result is null
            ? RepositoryResult<T>.NotFound()
            : RepositoryResult<T>.Success(result);
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetFavoritesByUserIdentifierAsync<T>(string userIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var items = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == userIdentifier)
            .SelectMany(u => u.MyFavorites ?? new List<Trail>())
            .OrderBy(t => t.Name)
            .Select(selector)
            .ToListAsync(ctoken);

        return RepositoryResult<IReadOnlyCollection<T>>.Success(items);
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetWishListByUserIdentifierAsync<T>(string userIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var items = await context.Users
            .AsNoTracking()
            .Where(u => u.Identifier == userIdentifier)
            .SelectMany(u => u.MyWishList ?? new List<Trail>())
            .OrderBy(t => t.Name)
            .Select(selector)
            .ToListAsync(ctoken);

        return RepositoryResult<IReadOnlyCollection<T>>.Success(items);
    }

    public async Task<RepositoryResult<User>> CreateUserAsync(User user, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        context.Users.Add(user);
        await context.SaveChangesAsync(ctoken);

        return RepositoryResult<User>.Success(user);
    }

    public async Task<RepositoryResult<T>> AddTrailToUserFavoritesListAsync<T>(string userIdentifier, string trailIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(u => u.MyFavorites)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
            return RepositoryResult<T>.NotFound();

        var trail = await context.Trails
            .FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

        if (trail is null)
            return RepositoryResult<T>.NotFound();

        user.MyFavorites ??= [];

        if (user.MyFavorites.Any(f => f.Identifier == trailIdentifier))
            return RepositoryResult<T>.Conflict();

        user.MyFavorites.Add(trail);

        try
        {
            await context.SaveChangesAsync(ctoken);
        }
        catch (DbUpdateException)
        {
            return RepositoryResult<T>.Conflict();
        }

        var result = await context.Trails
            .AsNoTracking()
            .Where(t => t.Identifier == trailIdentifier)
            .Select(selector)
            .FirstOrDefaultAsync(ctoken);

        return result is null
            ? RepositoryResult<T>.NotFound()
            : RepositoryResult<T>.Success(result);
    }

    public async Task<RepositoryResult<T>> AddTrailToUserWishListAsync<T>(string userIdentifier, string trailIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        using var context = await _context.CreateDbContextAsync(ctoken);

        var user = await context.Users
            .Include(u => u.MyWishList)
            .FirstOrDefaultAsync(u => u.Identifier == userIdentifier, ctoken);

        if (user is null)
            return RepositoryResult<T>.NotFound();

        var trail = await context.Trails
            .FirstOrDefaultAsync(t => t.Identifier == trailIdentifier, ctoken);

        if (trail is null)
            return RepositoryResult<T>.NotFound();

        user.MyWishList ??= [];

        if (user.MyWishList.Any(t => t.Identifier == trailIdentifier))
            return RepositoryResult<T>.Conflict();

        user.MyWishList.Add(trail);

        try
        {
            await context.SaveChangesAsync(ctoken);
        }
        catch (DbUpdateException)
        {
            return RepositoryResult<T>.Conflict();
        }

        var result = await context.Trails
            .AsNoTracking()
            .Where(t => t.Identifier == trailIdentifier)
            .Select(selector)
            .FirstOrDefaultAsync(ctoken);

        return result is null
            ? RepositoryResult<T>.NotFound()
            : RepositoryResult<T>.Success(result);
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
