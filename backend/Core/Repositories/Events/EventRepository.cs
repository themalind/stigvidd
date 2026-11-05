// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Linq.Expressions;

namespace Core.Repositories.Events;

public class EventRepository : IEventRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<EventRepository> _logger;

    public EventRepository(IDbContextFactory<StigViddDbContext> context, ILogger<EventRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<TrailAnchor>> GetTrailAnchorAsync(string trailIdentifier, int? currentTrailId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var trail = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == trailIdentifier && (t.IsVerified || t.Id == currentTrailId) && t.GeoPath != null)
                .Select(t => new { t.Id, t.GeoPath })
                .FirstOrDefaultAsync(ctoken);

            if (trail?.GeoPath is null || trail.GeoPath.IsEmpty)
                return RepositoryResult<TrailAnchor>.NotFound();

            return RepositoryResult<TrailAnchor>.Success(new TrailAnchor(trail.Id, trail.GeoPath.StartPoint));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetTrailAnchorAsync -> Something went wrong when reading trail {TrailIdentifier}.", trailIdentifier);
            return RepositoryResult<TrailAnchor>.Error();
        }
    }

    public async Task<RepositoryResult<LineString>> GetOwnHikePathAsync(string hikeIdentifier, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var path = await context.Hikes
                .AsNoTracking()
                .Where(h => h.Identifier == hikeIdentifier && h.UserId == userId)
                .Select(h => h.GeoPath)
                .FirstOrDefaultAsync(ctoken);

            return path is null || path.IsEmpty
                ? RepositoryResult<LineString>.NotFound()
                : RepositoryResult<LineString>.Success(path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetOwnHikePathAsync -> Something went wrong when reading hike {HikeIdentifier}.", hikeIdentifier);
            return RepositoryResult<LineString>.Error();
        }
    }

    public async Task<RepositoryResult<LineString>> GetRoutePathAsync(int eventId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var path = await context.EventRoutes
                .AsNoTracking()
                .Where(r => r.EventId == eventId)
                .Select(r => r.Path)
                .FirstOrDefaultAsync(ctoken);

            return path is null
                ? RepositoryResult<LineString>.NotFound()
                : RepositoryResult<LineString>.Success(path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetRoutePathAsync -> Something went wrong when reading the route of event {EventId}.", eventId);
            return RepositoryResult<LineString>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CountUpcomingAsOrganizerAsync(int userId, DateTime now, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var count = await context.Events
                .Where(e => e.Status == EventStatus.Published && e.PastAfter > now)
                .CountAsync(e => e.Participants.Any(p => p.UserId == userId && p.Role == EventParticipantRole.Organizer), ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: CountUpcomingAsOrganizerAsync -> Something went wrong when counting events for user {UserId}.", userId);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CountCreatedSinceAsync(int userId, DateTime since, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var count = await UserActionLogs.CountSinceAsync(context, userId, UserAction.EventCreated, since, ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: CountCreatedSinceAsync -> Something went wrong when counting events for user {UserId}.", userId);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<string>> CreateAsync(Event newEvent, int organizerUserId, TimeSpan createdLogWindow, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            newEvent.ParticipantCount = 1;
            newEvent.Participants.Add(new EventParticipant
            {
                UserId = organizerUserId,
                Role = EventParticipantRole.Organizer,
                Status = EventParticipantStatus.Joined,
            });

            context.Events.Add(newEvent);
            await UserActionLogs.RecordAsync(context, organizerUserId, UserAction.EventCreated, DateTime.UtcNow, createdLogWindow, ctoken);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<string>.Success(newEvent.Identifier);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: CreateAsync -> Something went wrong when creating an event for user {UserId}.", organizerUserId);
            return RepositoryResult<string>.Error();
        }
    }

    // Only what the feed would show anyone: open, published, visible and upcoming. keep-comment: the share page is anonymous
    public async Task<RepositoryResult<EventCard>> GetPublicCardAsync(string identifier, DateTime now, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var card = await context.Events
                .AsNoTracking()
                .Where(e => e.Identifier == identifier)
                .Where(EventQueries.PubliclyListed(now))
                .Select(EventQueries.Card(0, []))
                .FirstOrDefaultAsync(ctoken);

            return card is null
                ? RepositoryResult<EventCard>.NotFound()
                : RepositoryResult<EventCard>.Success(card);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetPublicCardAsync -> Something went wrong when reading event {Identifier}.", identifier);
            return RepositoryResult<EventCard>.Error();
        }
    }

    public async Task<RepositoryResult<EventDetail>> GetDetailAsync(string identifier, int viewerId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var detail = await context.Events
                .AsNoTracking()
                .Where(e => e.Identifier == identifier)
                .Select(e => new EventDetail(
                    e,
                    e.Trail == null ? null : e.Trail.Identifier,
                    e.Trail == null ? null : e.Trail.Name,
                    e.Trail == null ? null : e.Trail.TrailLength,
                    e.Route == null ? null : e.Route.LengthMetres,
                    e.Image == null ? null : e.Image.ImageUrl,
                    e.Image == null ? null : e.Image.ModerationState,
                    e.Image == null ? null : e.Image.Identifier,
                    e.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => (int?)p.UserId).FirstOrDefault(),
                    e.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => p.User == null ? null : p.User.NickName).FirstOrDefault(),
                    e.Participants.Count(p => p.Status == EventParticipantStatus.Interested),
                    e.Participants.Where(p => p.UserId == viewerId).Select(p => (EventParticipantRole?)p.Role).FirstOrDefault(),
                    e.Participants.Where(p => p.UserId == viewerId).Select(p => (EventParticipantStatus?)p.Status).FirstOrDefault(),
                    e.Invitations.Any(i => i.InvitedUserId == viewerId && i.Status == EventInvitationStatus.Pending)))
                .FirstOrDefaultAsync(ctoken);

            return detail is null
                ? RepositoryResult<EventDetail>.NotFound()
                : RepositoryResult<EventDetail>.Success(detail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetDetailAsync -> Something went wrong when reading event {Identifier}.", identifier);
            return RepositoryResult<EventDetail>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CountUnreadPostsAsync(int eventId, int viewerId, int[] hiddenUserIds, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var count = await context.EventParticipants
                .AsNoTracking()
                .Where(p => p.EventId == eventId && p.UserId == viewerId && p.Status == EventParticipantStatus.Joined)
                .Select(p => context.EventPosts.Count(post =>
                    post.EventId == eventId
                    && post.UserId != viewerId
                    && (post.UserId == null || !hiddenUserIds.Contains(post.UserId.Value))
                    && (p.LastReadPostAt == null || post.CreatedAt > p.LastReadPostAt)))
                .FirstOrDefaultAsync(ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: CountUnreadPostsAsync -> Something went wrong when counting unread posts on event {EventId}.", eventId);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyList<EventCard>>> GetFeedAsync(EventFeedFilter query, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var now = query.Now;
            var events = context.Events
                .AsNoTracking()
                .Where(EventQueries.PubliclyListed(now))
                .Where(EventQueries.OrganizerNotHidden(query.HiddenUserIds));

            if (query.TrailIdentifier is not null)
            {
                var trailIdentifier = query.TrailIdentifier;
                events = events.Where(e => e.Trail != null && e.Trail.Identifier == trailIdentifier);
            }

            if (query.OrganizerIdentifier is not null)
            {
                var organizerIdentifier = query.OrganizerIdentifier;
                events = events.Where(e => e.Participants.Any(p =>
                    p.User != null
                    && p.User.Identifier == organizerIdentifier
                    && p.Status == EventParticipantStatus.Joined
                    && (p.Role == EventParticipantRole.Organizer || p.Role == EventParticipantRole.CoHost)));
            }

            if (query.ExcludeMine)
            {
                var viewerId = query.ViewerId;
                events = events.Where(e => !e.Participants.Any(p => p.UserId == viewerId));
            }

            var cards = await events
                .Matching(query.Search)
                .InOrder(query.Order)
                .Take(query.Limit)
                .Select(EventQueries.Card(query.ViewerId, query.HiddenUserIds))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<EventCard>>.Success(cards);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetFeedAsync -> Something went wrong when reading the event feed for user {UserId}.", query.ViewerId);
            return RepositoryResult<IReadOnlyList<EventCard>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyList<EventCard>>> GetMineAsync(EventMineFilter query, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var viewerId = query.ViewerId;
            var now = query.Now;
            var events = context.Events
                .AsNoTracking()
                .Where(e => e.Participants.Any(p => p.UserId == viewerId && p.Status != EventParticipantStatus.Removed))
                .Where(EventQueries.OrganizerNotHidden(query.HiddenUserIds));

            events = query.Past
                ? events.Where(e => e.PastAfter <= now)
                : events.Where(e => e.PastAfter > now);

            var cards = await events
                .Matching(query.Search)
                .InOrder(query.Order)
                .Take(query.Limit)
                .Select(EventQueries.Card(query.ViewerId, query.HiddenUserIds))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<EventCard>>.Success(cards);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: GetMineAsync -> Something went wrong when reading the events of user {UserId}.", query.ViewerId);
            return RepositoryResult<IReadOnlyList<EventCard>>.Error();
        }
    }

    public async Task<RepositoryResult<UpdatedEvent>> UpdateAsync(string identifier, int editedByUserId, Action<Event> apply, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var eventId = await IdOfAsync(context, identifier, ctoken);

            if (eventId is null)
                return RepositoryResult<UpdatedEvent>.NotFound();

            await EventCounts.LockAsync(context, eventId.Value, ctoken);

            var existing = await context.Events
                .Include(e => e.Route)
                .FirstOrDefaultAsync(e => e.Id == eventId.Value, ctoken);

            if (existing is null)
                return RepositoryResult<UpdatedEvent>.NotFound();

            if (existing.Status == EventStatus.Cancelled)
                return RepositoryResult<UpdatedEvent>.Conflict();

            apply(existing);

            // Read under the row lock, so no join can land between this check and the save. keep-comment: the race this closes
            if (existing.MaxParticipants < existing.ParticipantCount)
                return RepositoryResult<UpdatedEvent>.Conflict();

            existing.LastUpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(ctoken);
            var notify = await EventAudience.ToNotifyAsync(context, existing.Id, editedByUserId, ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult<UpdatedEvent>.Success(new UpdatedEvent(notify));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: UpdateAsync -> Something went wrong when updating event {Identifier}.", identifier);
            return RepositoryResult<UpdatedEvent>.Error();
        }
    }

    public async Task<RepositoryResult<CancelledEvent>> CancelAsync(string identifier, int cancelledByUserId, DateTime now, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var eventId = await IdOfAsync(context, identifier, ctoken);

            if (eventId is null)
                return RepositoryResult<CancelledEvent>.NotFound();

            // Locked before the participants are read, so a join committing meanwhile still hears of the cancel. keep-comment: the race the lock closes
            await EventCounts.LockAsync(context, eventId.Value, ctoken);

            var existing = await context.Events
                .Include(e => e.Invitations)
                .Include(e => e.Participants)
                .FirstOrDefaultAsync(e => e.Id == eventId.Value, ctoken);

            if (existing is null)
                return RepositoryResult<CancelledEvent>.NotFound();

            if (existing.Status == EventStatus.Cancelled)
                return RepositoryResult<CancelledEvent>.Conflict();

            existing.Status = EventStatus.Cancelled;
            existing.CancelledAt = now;
            existing.LastUpdatedAt = now;
            context.EventInvitations.RemoveRange(existing.Invitations);

            var notify = EventAudience.ToNotify(existing.Participants, cancelledByUserId);

            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult<CancelledEvent>.Success(new CancelledEvent(existing.Title, existing.StartsAt, notify));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: CancelAsync -> Something went wrong when cancelling event {Identifier}.", identifier);
            return RepositoryResult<CancelledEvent>.Error();
        }
    }

    public async Task<RepositoryResult<DeletedEvent>> DeleteAsync(string identifier, int deletedByUserId, DateTime now, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var eventId = await IdOfAsync(context, identifier, ctoken);

            if (eventId is null)
                return RepositoryResult<DeletedEvent>.NotFound();

            // Locked before the participants are read, so a join committing meanwhile still hears of the delete. keep-comment: the race the lock closes
            await EventCounts.LockAsync(context, eventId.Value, ctoken);

            var deleted = await EventRemoval.RemoveAsync(context, e => e.Id == eventId.Value, deletedByUserId, now, ctoken);

            if (deleted is null)
                return RepositoryResult<DeletedEvent>.NotFound();

            await context.SaveChangesAsync(ctoken);

            if (deleted.ImageUrl is not null && await ImageReferences.IsReferencedAsync(context, deleted.ImageUrl, ctoken))
                deleted = deleted with { ImageUrl = null };

            await transaction.CommitAsync(ctoken);

            return RepositoryResult<DeletedEvent>.Success(deleted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventRepository: DeleteAsync -> Something went wrong when deleting event {Identifier}.", identifier);
            return RepositoryResult<DeletedEvent>.Error();
        }
    }

    private static Task<int?> IdOfAsync(StigViddDbContext context, string identifier, CancellationToken ctoken)
    {
        return context.Events
            .Where(e => e.Identifier == identifier)
            .Select(e => (int?)e.Id)
            .FirstOrDefaultAsync(ctoken);
    }
}
