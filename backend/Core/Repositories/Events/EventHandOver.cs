// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Events;

// The one hand-over rule, for leaving and for account deletion: the earliest-joined CoHost takes over, else an upcoming event is cancelled. keep-comment: plan decision
public static class EventHandOver
{
    // A banned organizer hands over their upcoming events as if they had left them; a lifted ban does not give the role back. keep-comment: plan decision, why not delete
    public static async Task<IReadOnlyList<HandOverOutcome>> RunForBannedAsync(StigViddDbContext context, int bannedUserId, CancellationToken ctoken)
    {
        var now = DateTime.UtcNow;
        var eventIds = await context.EventParticipants
            .Where(p => p.UserId == bannedUserId
                && p.Role == EventParticipantRole.Organizer
                && p.Event != null
                && p.Event.Status == EventStatus.Published
                && p.Event.PastAfter > now)
            .Select(p => p.EventId)
            .OrderBy(id => id)
            .ToListAsync(ctoken);

        foreach (var eventId in eventIds)
            await EventCounts.LockAsync(context, eventId, ctoken);

        var outcomes = new List<HandOverOutcome>();

        foreach (var eventId in eventIds)
        {
            var outcome = await RunAsync(context, eventId, bannedUserId, ctoken);

            if (outcome is not null)
                outcomes.Add(outcome);
        }

        return outcomes;
    }

    // Removes the leaving organizer's row and saves before promoting, because only one Organizer row may exist. keep-comment: IX_EventParticipants_OneOrganizer
    // Null when the user was not the organizer. keep-comment: the caller then has nothing to tell anyone
    // The caller takes EventCounts.LockAsync first, inside its transaction. keep-comment: the recount below relies on it
    public static async Task<HandOverOutcome?> RunAsync(StigViddDbContext context, int eventId, int leavingUserId, CancellationToken ctoken)
    {
        var existing = await context.Events
            .Include(e => e.Participants)
            .Include(e => e.Invitations)
            .FirstOrDefaultAsync(e => e.Id == eventId, ctoken);

        var leaving = existing?.Participants.FirstOrDefault(p => p.UserId == leavingUserId && p.Role == EventParticipantRole.Organizer);

        if (existing is null || leaving is null)
            return null;

        context.EventParticipants.Remove(leaving);
        await context.SaveChangesAsync(ctoken);

        var coHosts = existing.Participants
            .Where(p => p.Role == EventParticipantRole.CoHost && p.Status == EventParticipantStatus.Joined)
            .ToList();
        var coHostIds = coHosts.Select(p => p.UserId).ToList();

        // A banned CoHost cannot write, so as organizer they would leave the event with no one able to cancel it. keep-comment: why bans are checked here
        var banned = await context.UserBans
            .Where(b => b.LiftedAt == null && coHostIds.Contains(b.UserId))
            .Select(b => b.UserId)
            .ToListAsync(ctoken);

        var successor = coHosts
            .Where(p => !banned.Contains(p.UserId))
            .OrderBy(p => p.JoinedAt)
            .ThenBy(p => p.UserId)
            .FirstOrDefault();

        int? newOrganizerUserId = null;
        IReadOnlyCollection<int> cancelNotifyUserIds = [];
        var now = DateTime.UtcNow;
        var wasUpcoming = existing.Status == EventStatus.Published && existing.PastAfter > now;

        if (successor is not null)
        {
            successor.Role = EventParticipantRole.Organizer;
            newOrganizerUserId = successor.UserId;
        }
        else if (wasUpcoming)
        {
            existing.Status = EventStatus.Cancelled;
            existing.CancelledAt = now;
            existing.LastUpdatedAt = now;
            context.EventInvitations.RemoveRange(existing.Invitations);

            cancelNotifyUserIds = EventRemoval.ToNotifyOnCancel(existing.Participants, leavingUserId);
        }

        await context.SaveChangesAsync(ctoken);
        await EventCounts.RecountAsync(context, eventId, ctoken);
        await context.SaveChangesAsync(ctoken);

        return new HandOverOutcome(existing.Identifier, existing.Title, existing.StartsAt, wasUpcoming, newOrganizerUserId, cancelNotifyUserIds);
    }
}
