using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IFirebaseAuthRepository _firebaseAuthRepository;
    private readonly ILogger<UserRepository> _logger;

    public UserRepository(IDbContextFactory<StigViddDbContext> context, IFirebaseAuthRepository firebaseAuthRepository, ILogger<UserRepository> logger)
    {
        _context = context;
        _firebaseAuthRepository = firebaseAuthRepository;
        _logger = logger;
    }

    public async Task<RepositoryResult<T>> GetUserByFirebaseUidAsync<T>(string firebaseUid, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetUserByFirebaseUidAsync -> Something went wrong when fetching user with Firebase UID {firebaseUid}.", firebaseUid);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetUserIdByIdentifierAsync -> Something went wrong when fetching user ID with identifier {identifier}.", identifier);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetUserByIdentifierAsync<T>(string identifier, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetUserByIdentifierAsync -> Something went wrong when fetching user with identifier {identifier}.", identifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<T>> GetUserByNickNameAsync<T>(string nickName, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var result = await context.Users
                .AsNoTracking()
                .Where(u => u.NickName == nickName)
                .Select(selector)
                .FirstOrDefaultAsync(ctoken);

            return result is null
                ? RepositoryResult<T>.NotFound()
                : RepositoryResult<T>.Success(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetUserByNickNameAsync -> Something went wrong when fetching user with nickname {NickName}.", nickName);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<int>> GetUserIdByNameAsync(string name, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userId = await context.Users
                .AsNoTracking()
                .Where(u => u.NickName == name)
                .Select(u => (int?)u.Id)
                .FirstOrDefaultAsync(ctoken);

            return userId is null
                ? RepositoryResult<int>.NotFound()
                : RepositoryResult<int>.Success(userId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetUserIdByNameAsync -> Something went wrong when fetching user with name {name}.", name);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult> CheckUserNicknameAvaliability(string nickname, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var exists = await context.Users
                .AsNoTracking()
                .AnyAsync(u => u.NickName == nickname, ctoken);

            return exists ? RepositoryResult.Conflict() : RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetUserByNicknameAsync -> Something went wrong when fetching user with nickname {nickname}.", nickname);
            return RepositoryResult.Error();
        }
    }


    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetFavoritesByUserIdentifierAsync<T>(string userIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var items = await context.Users
                .AsNoTracking()
                .Where(u => u.Identifier == userIdentifier)
                .SelectMany(u => u.MyFavorites!)
                .OrderBy(t => t.Name)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetFavoritesByUserIdentifierAsync -> Something went wrong when fetching favorites for user {userIdentifier}.", userIdentifier);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetWishListByUserIdentifierAsync<T>(string userIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var items = await context.Users
                .AsNoTracking()
                .Where(u => u.Identifier == userIdentifier)
                .SelectMany(u => u.MyWishList!)
                .OrderBy(t => t.Name)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: GetWishListByUserIdentifierAsync -> Something went wrong when fetching wishlist for user {userIdentifier}.", userIdentifier);
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> CheckForUsername(string username, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            var exists = await context.Users
                .AsNoTracking()
                .AnyAsync(u => u.NickName == username, ctoken);

            return RepositoryResult<bool>.Success(exists);

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: CheckForUsername -> Something went wrong when checking for username {username}.", username);
            return RepositoryResult<bool>.Error();
        }
    }

    public async Task<RepositoryResult<User>> CreateUserAsync(User user, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.Users.Add(user);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<User>.Success(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: CreateUserAsync -> Something went wrong when creating user.");
            return RepositoryResult<User>.Error();
        }
    }

    public async Task<RepositoryResult<T>> AddTrailToUserFavoritesListAsync<T>(string userIdentifier, string trailIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: AddTrailToUserFavoritesListAsync -> Something went wrong when adding trail {trailIdentifier} to favorites for user {userIdentifier}.", trailIdentifier, userIdentifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult<T>> AddTrailToUserWishListAsync<T>(string userIdentifier, string trailIdentifier, Expression<Func<Trail, T>> selector, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: AddTrailToUserWishListAsync -> Something went wrong when adding trail {trailIdentifier} to wishlist for user {userIdentifier}.", trailIdentifier, userIdentifier);
            return RepositoryResult<T>.Error();
        }
    }

    public async Task<RepositoryResult> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: RemoveTrailFromUserFavoritesListAsync -> Something went wrong when removing trail {trailIdentifier} from favorites for user {userIdentifier}.", trailIdentifier, userIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: RemoveTrailFromUserWishListAsync -> Something went wrong when removing trail {trailIdentifier} from wishlist for user {userIdentifier}.", trailIdentifier, userIdentifier);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteUserAsync(string identifier, CancellationToken ctoken)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "UserRepository: DeleteUserAsync -> Something went wrong when deleting user with identifier {identifier}.", identifier);
            return RepositoryResult.Error();
        }
    }
}
