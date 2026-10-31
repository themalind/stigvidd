// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Events;

public class EventParticipantRepository : IEventParticipantRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<EventParticipantRepository> _logger;

    public EventParticipantRepository(IDbContextFactory<StigViddDbContext> context, ILogger<EventParticipantRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    // The one conditional increment: the spot is taken in the UPDATE itself, so two joins can never both get the last one. keep-comment: why not read-check-write
    // The event's state is checked again here, so a cancel, report or deadline since the service's check still refuses. keep-comment: the race the WHERE closes
    public Task<RepositoryResult> JoinAsync(int eventId, int userId, DateTime now, CancellationToken ctoken)
    {
        return TakeSpotAsync(eventId, userId, now, viaInvitation: false, ctoken);
    }

    public Task<RepositoryResult> AcceptInvitationAsync(int eventId, int userId, DateTime now, CancellationToken ctoken)
    {
        return TakeSpotAsync(eventId, userId, now, viaInvitation: true, ctoken);
    }

    // A pending invitation becomes Accepted either way, so joining an open event you were invited to clears the badge. keep-comment: why join touches invitations
    private async Task<RepositoryResult> TakeSpotAsync(int eventId, int userId, DateTime now, bool viaInvitation, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var taken = await context.Events
                .Where(e => e.Id == eventId
                    && e.Status == EventStatus.Published
                    && (viaInvitation || e.ModerationState == ModerationState.Visible)
                    && e.PastAfter > now
                    && (e.RegistrationDeadline == null || e.RegistrationDeadline >= now)
                    && (e.MaxParticipants == null || e.ParticipantCount < e.MaxParticipants))
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.ParticipantCount, e => e.ParticipantCount + 1), ctoken);

            if (taken == 0)
                return RepositoryResult.Conflict();

            var invitation = await context.EventInvitations
                .FirstOrDefaultAsync(i => i.EventId == eventId && i.InvitedUserId == userId && i.Status == EventInvitationStatus.Pending, ctoken);

            // Revoked or declined since the service checked; the rollback gives the spot back. keep-comment: the transaction is not committed here
            if (viaInvitation && invitation is null)
                return RepositoryResult.Conflict();

            if (invitation is not null)
                invitation.Status = EventInvitationStatus.Accepted;

            var existing = await context.EventParticipants.FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId, ctoken);

            if (existing is null)
            {
                context.EventParticipants.Add(new EventParticipant { EventId = eventId, UserId = userId, JoinedAt = now });
            }
            else if (existing.Status == EventParticipantStatus.Interested)
            {
                existing.Status = EventParticipantStatus.Joined;
                existing.JoinedAt = now;
            }
            else
            {
                // Joined or removed in a race since the service checked; the rollback gives the spot back. keep-comment: the transaction is not committed here
                return existing.Status == EventParticipantStatus.Joined
                    ? RepositoryResult.Success()
                    : RepositoryResult.NotFound();
            }

            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateException ex)
        {
            if (!await HasStatusAsync(eventId, userId, EventParticipantStatus.Joined, ctoken))
            {
                _logger.LogError(ex, "EventParticipantRepository: JoinAsync -> Saving failed when user {UserId} joined event {EventId}.", userId, eventId);
                return RepositoryResult.Error();
            }

            _logger.LogInformation(ex, "EventParticipantRepository: JoinAsync -> User {UserId} joined event {EventId} twice at once.", userId, eventId);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: JoinAsync -> Something went wrong when user {UserId} joined event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> MarkInterestedAsync(int eventId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var existing = await context.EventParticipants.FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId, ctoken);

            if (existing is not null)
            {
                return existing.Status == EventParticipantStatus.Interested
                    ? RepositoryResult.Success()
                    : RepositoryResult.Conflict();
            }

            context.EventParticipants.Add(new EventParticipant { EventId = eventId, UserId = userId, Status = EventParticipantStatus.Interested });
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateException ex)
        {
            if (!await HasStatusAsync(eventId, userId, EventParticipantStatus.Interested, ctoken))
            {
                _logger.LogError(ex, "EventParticipantRepository: MarkInterestedAsync -> Saving failed for user {UserId} and event {EventId}.", userId, eventId);
                return RepositoryResult.Error();
            }

            _logger.LogInformation(ex, "EventParticipantRepository: MarkInterestedAsync -> User {UserId} marked event {EventId} twice at once.", userId, eventId);
            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: MarkInterestedAsync -> Something went wrong for user {UserId} and event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> UnmarkInterestedAsync(int eventId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var existing = await context.EventParticipants
                .FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId && p.Status == EventParticipantStatus.Interested, ctoken);

            if (existing is null)
                return RepositoryResult.Success();

            context.EventParticipants.Remove(existing);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: UnmarkInterestedAsync -> Something went wrong for user {UserId} and event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    // A removed row stays, so leaving cannot be used to rejoin. keep-comment: Removed blocks rejoining
    public async Task<RepositoryResult<LeftEvent>> LeaveAsync(int eventId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);
            await EventCounts.LockAsync(context, eventId, ctoken);

            var existing = await context.EventParticipants.FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId, ctoken);

            if (existing is null || existing.Status == EventParticipantStatus.Removed)
                return RepositoryResult<LeftEvent>.Success(new LeftEvent(null));

            HandOverOutcome? handOver = null;

            if (existing.Role == EventParticipantRole.Organizer)
            {
                handOver = await EventHandOver.RunAsync(context, eventId, userId, ctoken);
            }
            else
            {
                context.EventParticipants.Remove(existing);
                await context.SaveChangesAsync(ctoken);
                await EventCounts.RecountAsync(context, eventId, ctoken);
                await context.SaveChangesAsync(ctoken);
            }

            await transaction.CommitAsync(ctoken);

            return RepositoryResult<LeftEvent>.Success(new LeftEvent(handOver));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: LeaveAsync -> Something went wrong when user {UserId} left event {EventId}.", userId, eventId);
            return RepositoryResult<LeftEvent>.Error();
        }
    }

    public async Task<RepositoryResult<EventParticipantRow>> GetAsync(int eventId, string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var row = await context.EventParticipants
                .AsNoTracking()
                .Where(p => p.EventId == eventId && p.User != null && p.User.Identifier == userIdentifier)
                .Select(Row())
                .FirstOrDefaultAsync(ctoken);

            return row is null
                ? RepositoryResult<EventParticipantRow>.NotFound()
                : RepositoryResult<EventParticipantRow>.Success(row);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: GetAsync -> Something went wrong when reading user {UserIdentifier} in event {EventId}.", userIdentifier, eventId);
            return RepositoryResult<EventParticipantRow>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyList<EventParticipantRow>>> GetJoinedAsync(int eventId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var rows = await context.EventParticipants
                .AsNoTracking()
                .Where(p => p.EventId == eventId && p.Status == EventParticipantStatus.Joined && p.User != null)
                .OrderBy(p => p.Role)
                .ThenBy(p => p.JoinedAt)
                .ThenBy(p => p.UserId)
                .Select(Row())
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<EventParticipantRow>>.Success(rows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: GetJoinedAsync -> Something went wrong when reading the participants of event {EventId}.", eventId);
            return RepositoryResult<IReadOnlyList<EventParticipantRow>>.Error();
        }
    }

    public async Task<RepositoryResult> RemoveAsync(int eventId, int userId, IReadOnlyCollection<EventParticipantRole> removableRoles, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);
            await EventCounts.LockAsync(context, eventId, ctoken);

            var existing = await context.EventParticipants.FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId, ctoken);

            if (existing is null)
                return RepositoryResult.NotFound();

            if (existing.Status == EventParticipantStatus.Removed)
                return RepositoryResult.Success();

            if (!removableRoles.Contains(existing.Role))
                return RepositoryResult.Conflict();

            existing.Status = EventParticipantStatus.Removed;
            existing.Role = EventParticipantRole.Participant;
            await context.SaveChangesAsync(ctoken);
            await EventCounts.RecountAsync(context, eventId, ctoken);
            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: RemoveAsync -> Something went wrong when removing user {UserId} from event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> SetRoleAsync(int eventId, int userId, EventParticipantRole role, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);
            await EventCounts.LockAsync(context, eventId, ctoken);

            var existing = await context.EventParticipants
                .FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId && p.Status == EventParticipantStatus.Joined, ctoken);

            if (existing is null)
                return RepositoryResult.NotFound();

            if (existing.Role == EventParticipantRole.Organizer)
                return RepositoryResult.Conflict();

            existing.Role = role;
            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: SetRoleAsync -> Something went wrong when changing the role of user {UserId} in event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> SetMutedAsync(int eventId, int userId, bool muted, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var existing = await context.EventParticipants
                .FirstOrDefaultAsync(p => p.EventId == eventId && p.UserId == userId && p.Status == EventParticipantStatus.Joined, ctoken);

            if (existing is null)
                return RepositoryResult.NotFound();

            existing.MutePosts = muted;
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventParticipantRepository: SetMutedAsync -> Something went wrong for user {UserId} and event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    // A failed insert is a lost race only if the row it lost to is there; anything else (a deleted event or user) is an error. keep-comment: why the catch re-reads
    private async Task<bool> HasStatusAsync(int eventId, int userId, EventParticipantStatus status, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            return await context.EventParticipants.AnyAsync(p => p.EventId == eventId && p.UserId == userId && p.Status == status, ctoken);
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static System.Linq.Expressions.Expression<Func<EventParticipant, EventParticipantRow>> Row()
    {
        return p => new EventParticipantRow(
            p.UserId,
            p.User == null ? "" : p.User.Identifier,
            p.User == null ? "" : p.User.NickName,
            p.Role,
            p.Status,
            p.JoinedAt);
    }
}
