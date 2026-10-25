// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

    public async Task<RepositoryResult<IEnumerable<T>>> GetFriendsAsync<T>(int userId, int[] hiddenUserIds, Expression<Func<User, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var query = context.Users
                .AsNoTracking()
                .Where(u => context.FriendRequests.Any(fr =>
                    fr.Status == FriendRequestStatus.Accepted &&
                    ((fr.RequesterId == userId && fr.ReceiverId == u.Id) ||
                    (fr.ReceiverId == userId && fr.RequesterId == u.Id))))
                .Where(u => !hiddenUserIds.Contains(u.Id));

            var ordered = SwedishCollation.For(context) is { } collation
                ? query.OrderBy(u => EF.Functions.Collate(u.NickName, collation))
                : query.OrderBy(u => u.NickName);

            var friends = await ordered
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

    public async Task<RepositoryResult<IEnumerable<T>>> GetIncomingRequestsAsync<T>(int userId, int[] hiddenUserIds, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var incomingRequests = await context.FriendRequests
                .AsNoTracking()
                .Where(fr => fr.ReceiverId == userId && fr.Status == FriendRequestStatus.Pending)
                .Where(fr => !hiddenUserIds.Contains(fr.RequesterId))
                .OrderByDescending(fr => fr.CreatedAt)
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

    public async Task<RepositoryResult<IEnumerable<T>>> GetOutgoingRequestsAsync<T>(int userId, int[] hiddenUserIds, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var outgoingRequests = await context.FriendRequests
                .AsNoTracking()
                .Where(fr => fr.RequesterId == userId && fr.Status == FriendRequestStatus.Pending)
                .Where(fr => !hiddenUserIds.Contains(fr.ReceiverId))
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
            context.FriendNotes.RemoveRange(context.FriendNotes.Where(fn =>
                (fn.OwnerUserId == userId && fn.FriendUserId == otherUserId) ||
                (fn.OwnerUserId == otherUserId && fn.FriendUserId == userId)));
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
            friendRequest.AcceptedAt = DateTime.UtcNow;
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

    public async Task<RepositoryResult> SetNoteAsync(int ownerUserId, int friendUserId, string? text, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var note = await context.FriendNotes
                .FirstOrDefaultAsync(fn => fn.OwnerUserId == ownerUserId && fn.FriendUserId == friendUserId, ctoken);

            if (string.IsNullOrWhiteSpace(text))
            {
                if (note != null)
                    context.FriendNotes.Remove(note);
            }
            else if (note == null)
            {
                context.FriendNotes.Add(new FriendNote { OwnerUserId = ownerUserId, FriendUserId = friendUserId, Text = text });
            }
            else
            {
                note.Text = text;
                note.LastUpdatedAt = DateTime.UtcNow;
            }

            await context.SaveChangesAsync(ctoken);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving the note user {OwnerUserId} keeps on user {FriendUserId}", ownerUserId, friendUserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyDictionary<string, DateTime>>> GetFriendsSinceByIdentifierAsync(int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var since = await context.FriendRequests
                .AsNoTracking()
                .Where(fr => fr.Status == FriendRequestStatus.Accepted && (fr.RequesterId == userId || fr.ReceiverId == userId))
                .Join(context.Users, fr => fr.RequesterId == userId ? fr.ReceiverId : fr.RequesterId, u => u.Id, (fr, u) => new { u.Identifier, Since = fr.AcceptedAt ?? fr.CreatedAt })
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyDictionary<string, DateTime>>.Success(
                since.GroupBy(f => f.Identifier).ToDictionary(g => g.Key, g => g.Min(f => f.Since)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading friendship dates of user {UserId}", userId);
            return RepositoryResult<IReadOnlyDictionary<string, DateTime>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyDictionary<string, string>>> GetNotesByFriendIdentifierAsync(int ownerUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var notes = await context.FriendNotes
                .AsNoTracking()
                .Where(fn => fn.OwnerUserId == ownerUserId)
                .Join(context.Users, fn => fn.FriendUserId, u => u.Id, (fn, u) => new { u.Identifier, fn.Text })
                .ToDictionaryAsync(n => n.Identifier, n => n.Text, ctoken);

            return RepositoryResult<IReadOnlyDictionary<string, string>>.Success(notes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading the notes of user {OwnerUserId}", ownerUserId);
            return RepositoryResult<IReadOnlyDictionary<string, string>>.Error();
        }
    }
}
