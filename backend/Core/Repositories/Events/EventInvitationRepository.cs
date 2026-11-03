// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Events;

public class EventInvitationRepository : IEventInvitationRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<EventInvitationRepository> _logger;

    public EventInvitationRepository(IDbContextFactory<StigViddDbContext> context, ILogger<EventInvitationRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyList<InviteeCandidate>>> FindByNickNamesAsync(IReadOnlyCollection<string> nickNames, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var users = await context.Users
                .AsNoTracking()
                .Where(u => nickNames.Contains(u.NickName))
                .Select(u => new InviteeCandidate(u.Id, u.NickName))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<InviteeCandidate>>.Success(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: FindByNickNamesAsync -> Something went wrong when looking up {Count} nicknames.", nickNames.Count);
            return RepositoryResult<IReadOnlyList<InviteeCandidate>>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CountInvitedSinceAsync(int inviterUserId, DateTime since, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var count = await UserActionLogs.CountSinceAsync(context, inviterUserId, UserAction.EventInvited, since, ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: CountInvitedSinceAsync -> Something went wrong when counting invitations by user {UserId}.", inviterUserId);
            return RepositoryResult<int>.Error();
        }
    }

    // Participants and pending invitees are skipped silently; a Declined or Accepted row goes back to Pending as a new invitation. keep-comment: plan decision, so a mistaken decline can be fixed
    // An invitee who blocked the inviter counts toward the cap but gets no row, so the cap cannot be used to find a block. keep-comment: why blocked invitees are counted
    // Locked like a cancel, so an invitation cannot land after a cancel has deleted the event's invitations. keep-comment: the race the lock closes
    public async Task<RepositoryResult<InviteOutcome>> InviteAsync(int eventId, int inviterUserId, IReadOnlyCollection<int> userIds, int maxNew, DateTime now, TimeSpan logWindow, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);
            await EventCounts.LockAsync(context, eventId, ctoken);

            var open = await context.Events.AnyAsync(e => e.Id == eventId
                && e.Status == EventStatus.Published
                && e.ModerationState == ModerationState.Visible
                && e.PastAfter > now, ctoken);

            if (!open)
                return RepositoryResult<InviteOutcome>.NotFound();

            // Only a host's invitation reaches someone who was removed; accepting it lets them back in. keep-comment: plan decision 2026-11-03, a removal is undone by a host's invite
            var inviterIsHost = await EventHosts.IsHostAsync(context, eventId, inviterUserId, ctoken);

            var participants = await context.EventParticipants
                .Where(p => p.EventId == eventId && userIds.Contains(p.UserId)
                    && !(inviterIsHost && p.Status == EventParticipantStatus.Removed))
                .Select(p => p.UserId)
                .ToListAsync(ctoken);

            var existing = await context.EventInvitations
                .Where(i => i.EventId == eventId && userIds.Contains(i.InvitedUserId))
                .ToListAsync(ctoken);

            var newInvitees = userIds
                .Where(id => !participants.Contains(id)
                    && !existing.Any(i => i.InvitedUserId == id && i.Status == EventInvitationStatus.Pending))
                .ToList();

            if (newInvitees.Count > maxNew)
                return RepositoryResult<InviteOutcome>.Conflict();

            var blockedInviter = await context.UserBlocks
                .Where(b => b.BlockedUserId == inviterUserId && newInvitees.Contains(b.BlockerUserId))
                .Select(b => b.BlockerUserId)
                .ToListAsync(ctoken);

            var notify = newInvitees.Where(id => !blockedInviter.Contains(id)).ToList();

            foreach (var userId in notify)
            {
                var row = existing.FirstOrDefault(i => i.InvitedUserId == userId);

                if (row is null)
                {
                    context.EventInvitations.Add(new EventInvitation { EventId = eventId, InvitedUserId = userId, InvitedByUserId = inviterUserId, CreatedAt = now });
                    continue;
                }

                row.Status = EventInvitationStatus.Pending;
                row.InvitedByUserId = inviterUserId;
                row.CreatedAt = now;
            }

            if (newInvitees.Count > 0)
                await UserActionLogs.RecordAsync(context, inviterUserId, UserAction.EventInvited, now, logWindow, newInvitees.Count, ctoken);

            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            var inviterNickName = await context.Users
                .Where(u => u.Id == inviterUserId)
                .Select(u => u.NickName)
                .FirstOrDefaultAsync(ctoken);

            return RepositoryResult<InviteOutcome>.Success(new InviteOutcome(inviterNickName ?? "", notify));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: InviteAsync -> Something went wrong when user {UserId} invited to event {EventId}.", inviterUserId, eventId);
            return RepositoryResult<InviteOutcome>.Error();
        }
    }

    // Upcoming events only, in the order they happen; a cancel deletes its invitations, so cancelled ones never show. keep-comment: why only PastAfter is filtered
    public async Task<RepositoryResult<IReadOnlyList<PendingInvitation>>> GetPendingForUserAsync(int userId, int[] hiddenUserIds, DateTime now, int limit, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var invitations = await context.EventInvitations
                .AsNoTracking()
                .Where(i => i.InvitedUserId == userId
                    && i.Status == EventInvitationStatus.Pending
                    && i.Event != null
                    && i.Event.Status == EventStatus.Published
                    && i.Event.PastAfter > now
                    && !i.Event.Participants.Any(p => p.Role == EventParticipantRole.Organizer && hiddenUserIds.Contains(p.UserId)))
                .Select(i => new
                {
                    i.EventId,
                    StartsAt = i.Event == null ? DateTime.MinValue : i.Event.StartsAt,
                    i.InvitedByUserId,
                    InvitedByNickName = i.InvitedBy == null ? null : i.InvitedBy.NickName,
                    i.CreatedAt,
                })
                .OrderBy(i => i.StartsAt)
                .ThenBy(i => i.EventId)
                .Take(limit)
                .ToListAsync(ctoken);

            var eventIds = invitations.Select(i => i.EventId).ToList();
            var cards = await context.Events
                .AsNoTracking()
                .Where(e => eventIds.Contains(e.Id))
                .Select(EventQueries.Card(userId, hiddenUserIds))
                .ToDictionaryAsync(c => c.Id, ctoken);

            var pending = invitations
                .Where(i => cards.ContainsKey(i.EventId))
                .Select(i => new PendingInvitation(cards[i.EventId], i.InvitedByUserId, i.InvitedByNickName, i.CreatedAt))
                .ToList();

            return RepositoryResult<IReadOnlyList<PendingInvitation>>.Success(pending);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: GetPendingForUserAsync -> Something went wrong when reading the invitations of user {UserId}.", userId);
            return RepositoryResult<IReadOnlyList<PendingInvitation>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyList<EventInvitee>>> GetPendingForEventAsync(int eventId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var invitees = await context.EventInvitations
                .AsNoTracking()
                .Where(i => i.EventId == eventId && i.Status == EventInvitationStatus.Pending && i.InvitedUser != null)
                .OrderBy(i => i.CreatedAt)
                .ThenBy(i => i.InvitedUserId)
                .Select(i => new EventInvitee(
                    i.InvitedUserId,
                    i.InvitedUser == null ? "" : i.InvitedUser.Identifier,
                    i.InvitedUser == null ? "" : i.InvitedUser.NickName,
                    i.InvitedByUserId,
                    i.InvitedBy == null ? null : i.InvitedBy.NickName,
                    i.CreatedAt))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<EventInvitee>>.Success(invitees);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: GetPendingForEventAsync -> Something went wrong when reading the invitations of event {EventId}.", eventId);
            return RepositoryResult<IReadOnlyList<EventInvitee>>.Error();
        }
    }

    public async Task<RepositoryResult<InvitationRow>> GetPendingAsync(int eventId, string invitedUserIdentifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var row = await context.EventInvitations
                .AsNoTracking()
                .Where(i => i.EventId == eventId
                    && i.Status == EventInvitationStatus.Pending
                    && i.InvitedUser != null
                    && i.InvitedUser.Identifier == invitedUserIdentifier)
                .Select(i => new InvitationRow(i.InvitedUserId, i.InvitedByUserId))
                .FirstOrDefaultAsync(ctoken);

            return row is null
                ? RepositoryResult<InvitationRow>.NotFound()
                : RepositoryResult<InvitationRow>.Success(row);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: GetPendingAsync -> Something went wrong when reading the invitation of {UserIdentifier} to event {EventId}.", invitedUserIdentifier, eventId);
            return RepositoryResult<InvitationRow>.Error();
        }
    }

    public async Task<RepositoryResult> DeclineAsync(int eventId, int userId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var row = await context.EventInvitations
                .FirstOrDefaultAsync(i => i.EventId == eventId && i.InvitedUserId == userId && i.Status == EventInvitationStatus.Pending, ctoken);

            if (row is null)
                return RepositoryResult.Success();

            row.Status = EventInvitationStatus.Declined;
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: DeclineAsync -> Something went wrong when user {UserId} declined event {EventId}.", userId, eventId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> RevokeAsync(int eventId, int invitedUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var row = await context.EventInvitations
                .FirstOrDefaultAsync(i => i.EventId == eventId && i.InvitedUserId == invitedUserId && i.Status == EventInvitationStatus.Pending, ctoken);

            if (row is null)
                return RepositoryResult.Success();

            context.EventInvitations.Remove(row);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventInvitationRepository: RevokeAsync -> Something went wrong when revoking the invitation of user {UserId} to event {EventId}.", invitedUserId, eventId);
            return RepositoryResult.Error();
        }
    }
}
