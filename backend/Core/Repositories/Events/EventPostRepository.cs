// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories.Events;

public class EventPostRepository : IEventPostRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<EventPostRepository> _logger;

    public EventPostRepository(IDbContextFactory<StigViddDbContext> context, ILogger<EventPostRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    // Read-only: the read marker moves only through MarkReadAsync, so a prefetch never marks posts read. keep-comment: plan decision
    public async Task<RepositoryResult<EventBoardPage>> GetBoardAsync(int eventId, int viewerId, int[] hiddenUserIds, EventPageKey? before, int limit, bool includePinned, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var visible = context.EventPosts
                .AsNoTracking()
                .Where(p => p.EventId == eventId && (p.UserId == null || !hiddenUserIds.Contains(p.UserId.Value)));

            var page = visible;

            if (before is not null)
            {
                var at = before.At;
                var id = before.Id;
                page = page.Where(p => p.CreatedAt < at || (p.CreatedAt == at && p.Id < id));
            }

            var newestFirst = await page
                .OrderByDescending(p => p.CreatedAt)
                .ThenByDescending(p => p.Id)
                .Take(limit + 1)
                .Select(Row())
                .ToListAsync(ctoken);

            var hasMore = newestFirst.Count > limit;
            var posts = newestFirst.Take(limit).Reverse().ToList();

            var pinned = includePinned
                ? await visible
                    .Where(p => p.IsPinned)
                    .OrderBy(p => p.CreatedAt)
                    .ThenBy(p => p.Id)
                    .Select(Row())
                    .ToListAsync(ctoken)
                : [];

            var reader = await context.EventParticipants
                .AsNoTracking()
                .Where(p => p.EventId == eventId && p.UserId == viewerId)
                .Select(p => new { p.LastReadPostAt, p.MutePosts })
                .FirstOrDefaultAsync(ctoken);

            return RepositoryResult<EventBoardPage>.Success(
                new EventBoardPage(pinned, posts, hasMore, reader?.LastReadPostAt, reader?.MutePosts ?? false));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: GetBoardAsync -> Something went wrong when reading the board of event {EventId}.", eventId);
            return RepositoryResult<EventBoardPage>.Error();
        }
    }

    // Muted readers, readers pushed within the throttle and readers who blocked the author get nothing, and their LastPostPushAt stays. keep-comment: a blocker must not be throttled by a push they never got
    public async Task<RepositoryResult<CreatedEventPost>> CreateAsync(int eventId, int authorId, string body, Guid? clientRequestId, DateTime now, TimeSpan pushThrottle, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var author = await context.EventParticipants
                .Where(p => p.EventId == eventId && p.UserId == authorId && p.Status == EventParticipantStatus.Joined)
                .Select(p => p.User == null ? null : new { p.User.Identifier, p.User.NickName })
                .FirstOrDefaultAsync(ctoken);

            if (author is null)
                return RepositoryResult<CreatedEventPost>.NotFound();

            if (await FindRetriedAsync(context, clientRequestId, eventId, authorId, ctoken) is EventPostRow retried)
                return RepositoryResult<CreatedEventPost>.Success(new CreatedEventPost(retried, []));

            var post = new EventPost
            {
                ClientRequestId = clientRequestId,
                EventId = eventId,
                UserId = authorId,
                Body = body.Trim(),
                CreatedAt = now,
                LastUpdatedAt = now,
            };
            context.EventPosts.Add(post);

            var pushedBefore = now - pushThrottle;
            var due = await context.EventParticipants
                .Where(p => p.EventId == eventId
                    && p.UserId != authorId
                    && p.Status == EventParticipantStatus.Joined
                    && !p.MutePosts
                    && (p.LastPostPushAt == null || p.LastPostPushAt <= pushedBefore)
                    && !context.UserBlocks.Any(b => b.BlockerUserId == p.UserId && b.BlockedUserId == authorId))
                .ToListAsync(ctoken);

            foreach (var reader in due)
                reader.LastPostPushAt = now;

            try
            {
                await context.SaveChangesAsync(ctoken);
            }
            catch (DbUpdateException) when (clientRequestId is not null)
            {
                await transaction.RollbackAsync(ctoken);

                // keep-comment: the first attempt can still be in flight when the retry arrives, and it already sent the push
                using var fresh = await _context.CreateDbContextAsync(ctoken);

                if (await FindRetriedAsync(fresh, clientRequestId, eventId, authorId, ctoken) is EventPostRow winner)
                    return RepositoryResult<CreatedEventPost>.Success(new CreatedEventPost(winner, []));

                throw;
            }

            await transaction.CommitAsync(ctoken);

            var row = new EventPostRow(post.Id, post.Identifier, authorId, author.Identifier, author.NickName, post.Body, false, now, null);
            return RepositoryResult<CreatedEventPost>.Success(new CreatedEventPost(row, due.Select(p => p.UserId).ToList()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: CreateAsync -> Something went wrong when user {UserId} posted on event {EventId}.", authorId, eventId);
            return RepositoryResult<CreatedEventPost>.Error();
        }
    }

    private static Task<EventPostRow?> FindRetriedAsync(StigViddDbContext context, Guid? clientRequestId, int eventId, int authorId, CancellationToken ctoken)
    {
        if (clientRequestId is null)
            return Task.FromResult<EventPostRow?>(null);

        return context.EventPosts
            .IgnoreQueryFilters(["Moderation"])
            .Where(p => p.ClientRequestId == clientRequestId && p.EventId == eventId && p.UserId == authorId)
            .Select(p => new EventPostRow(
                p.Id,
                p.Identifier,
                p.UserId,
                p.User == null ? null : p.User.Identifier,
                p.User == null ? null : p.User.NickName,
                p.Body,
                p.IsPinned,
                p.CreatedAt,
                p.EditedAt))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<RepositoryResult<EventPostTarget>> FindAsync(string postIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var target = await context.EventPosts
                .AsNoTracking()
                .Where(p => p.Identifier == postIdentifier && p.Event != null)
                .Select(p => new EventPostTarget(p.Id, p.Event == null ? "" : p.Event.Identifier, p.UserId))
                .FirstOrDefaultAsync(ctoken);

            return target is null
                ? RepositoryResult<EventPostTarget>.NotFound()
                : RepositoryResult<EventPostTarget>.Success(target);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: FindAsync -> Something went wrong when reading post {PostIdentifier}.", postIdentifier);
            return RepositoryResult<EventPostTarget>.Error();
        }
    }

    public async Task<RepositoryResult<EventPostRow>> UpdateAsync(int postId, string body, DateTime now, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var post = await context.EventPosts
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.Id == postId, ctoken);

            if (post is null)
                return RepositoryResult<EventPostRow>.NotFound();

            post.Body = body.Trim();
            post.EditedAt = now;
            post.LastUpdatedAt = now;
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<EventPostRow>.Success(ToRow(post));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: UpdateAsync -> Something went wrong when editing post {PostId}.", postId);
            return RepositoryResult<EventPostRow>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteAsync(int postId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var post = await context.EventPosts.FirstOrDefaultAsync(p => p.Id == postId, ctoken);

            if (post is null)
                return RepositoryResult.Success();

            context.EventPosts.Remove(post);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: DeleteAsync -> Something went wrong when deleting post {PostId}.", postId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> SetPinnedAsync(int postId, bool pinned, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var post = await context.EventPosts.FirstOrDefaultAsync(p => p.Id == postId, ctoken);

            if (post is null)
                return RepositoryResult.NotFound();

            post.IsPinned = pinned;
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: SetPinnedAsync -> Something went wrong when pinning post {PostId}.", postId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> MarkReadAsync(int eventId, int userId, DateTime readUpTo, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var reader = await context.EventParticipants
                .FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId && p.Status == EventParticipantStatus.Joined, ctoken);

            if (reader is null)
                return RepositoryResult.NotFound();

            if (reader.LastReadPostAt is null || reader.LastReadPostAt < readUpTo)
            {
                reader.LastReadPostAt = readUpTo;
                await context.SaveChangesAsync(ctoken);
            }

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventPostRepository: MarkReadAsync -> Something went wrong for user {UserId} and event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    private static readonly Func<EventPost, EventPostRow> ToRow = Row().Compile();

    private static Expression<Func<EventPost, EventPostRow>> Row()
    {
        return p => new EventPostRow(
            p.Id,
            p.Identifier,
            p.UserId,
            p.User == null ? null : p.User.Identifier,
            p.User == null ? null : p.User.NickName,
            p.Body,
            p.IsPinned,
            p.CreatedAt,
            p.EditedAt);
    }
}
