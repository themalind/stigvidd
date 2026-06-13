using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;


namespace Core.Repositories;

public class FriendRepository : IFriendRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<FriendRepository> _logger;

    public FriendRepository(IDbContextFactory<StigViddDbContext> context, ILogger<FriendRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<bool>> FriendshipExistsAsync(int userId, int otherUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var exists = await context.FriendRequests
                .AnyAsync(fr => ((fr.RequesterId == userId && fr.ReceiverId == otherUserId) ||
                 (fr.RequesterId == otherUserId && fr.ReceiverId == userId)) &&
                 fr.Status == FriendRequestStatus.Accepted, ctoken);

            return RepositoryResult<bool>.Success(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking friendship existence between user {UserId} and {OtherUserId}", userId, otherUserId);
            return RepositoryResult<bool>.Error();
        }

    }

    public async Task<RepositoryResult<IEnumerable<T>>> GetFriendsAsync<T>(int userId, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var friends = await context.Users
                .AsNoTracking()
                .Where(u => context.FriendRequests.Any(fr =>
                    fr.Status == FriendRequestStatus.Accepted &&
                    ((fr.RequesterId == userId && fr.ReceiverId == u.Id) ||
                    (fr.ReceiverId == userId && fr.RequesterId == u.Id))))
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<T>>.Success(friends);
        }
        catch
        {
            _logger.LogError("Error retrieving friends for user {UserId}", userId);
            return RepositoryResult<IEnumerable<T>>.Error();
        }
    }

    public async Task<RepositoryResult<IEnumerable<T>>> GetIncomingRequestsAsync<T>(int userId, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var incomingRequests = await context.FriendRequests
                .AsNoTracking()
                .Where(fr => fr.ReceiverId == userId && fr.Status == FriendRequestStatus.Pending)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IEnumerable<T>>.Success(incomingRequests);

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incoming friend requests for user {UserId}", userId);
            return RepositoryResult<IEnumerable<T>>.Error();
        }
    }

    public async Task<RepositoryResult<IEnumerable<T>>> GetOutgoingRequestsAsync<T>(int userId, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var outgoingRequests = await context.FriendRequests
                .AsNoTracking()
                .Where(fr => fr.RequesterId == userId && fr.Status == FriendRequestStatus.Pending)
                .Select(selector)
                .ToListAsync(ctoken);
            return RepositoryResult<IEnumerable<T>>.Success(outgoingRequests);

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving outgoing friend requests for user {UserId}", userId);
            return RepositoryResult<IEnumerable<T>>.Error();
        }
    }

    public async Task<RepositoryResult> RemoveFriendShipOrFriendRequestAsync(int userId, int otherUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var friendRequest = await context.FriendRequests
                .FirstOrDefaultAsync(fr => (fr.RequesterId == userId && fr.ReceiverId == otherUserId) ||
                                            (fr.RequesterId == otherUserId && fr.ReceiverId == userId), ctoken);

            if (friendRequest == null)
            {
                return RepositoryResult.NotFound();
            }

            context.FriendRequests.Remove(friendRequest);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing friend or request between user {UserId} and {OtherUserId}", userId, otherUserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> AcceptRequestAsync(int requesterId, int receiverId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var friendRequest = await context.FriendRequests
                .FirstOrDefaultAsync(fr => fr.RequesterId == requesterId && fr.ReceiverId == receiverId && fr.Status == FriendRequestStatus.Pending, ctoken);

            if (friendRequest == null)
                return RepositoryResult.NotFound();

            friendRequest.Status = FriendRequestStatus.Accepted;
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error accepting friend request from user {RequesterId} to user {ReceiverId}", requesterId, receiverId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> RejectRequestAsync(int requesterId, int receiverId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var friendRequest = await context.FriendRequests
                .FirstOrDefaultAsync(fr => fr.RequesterId == requesterId && fr.ReceiverId == receiverId && fr.Status == FriendRequestStatus.Pending, ctoken);

            if (friendRequest == null)
                return RepositoryResult.NotFound();

            context.FriendRequests.Remove(friendRequest);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting friend request from user {RequesterId} to user {ReceiverId}", requesterId, receiverId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteAllFriendRequestsByUserIdAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var requests = await context.FriendRequests
                .Where(fr => fr.RequesterId == userId || fr.ReceiverId == userId)
                .ToListAsync(ctoken);

            context.FriendRequests.RemoveRange(requests);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting friend requests for user {UserId}", userId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> SendRequestAsync(int requesterId, int receiverId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var existingRequest = await context.FriendRequests
                .AnyAsync(fr =>
                    ((fr.RequesterId == requesterId && fr.ReceiverId == receiverId) ||
                     (fr.RequesterId == receiverId && fr.ReceiverId == requesterId)) &&
                    (fr.Status == FriendRequestStatus.Pending || fr.Status == FriendRequestStatus.Accepted), ctoken);

            if (existingRequest)
            {
                return RepositoryResult.Conflict();
            }

            var friendRequest = new FriendRequest
            {
                RequesterId = requesterId,
                ReceiverId = receiverId,
                Status = FriendRequestStatus.Pending
            };

            context.FriendRequests.Add(friendRequest);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending friend request from user {RequesterId} to user {ReceiverId}", requesterId, receiverId);
            return RepositoryResult.Error();
        }
    }
}
