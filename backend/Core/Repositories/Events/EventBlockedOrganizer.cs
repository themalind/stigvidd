// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Events;

// Blocking an organizer leaves their events: you block someone to be rid of them, and a leave notifies nobody. keep-comment: plan decision, why a block touches events
public static class EventBlockedOrganizer
{
    // Removed rows stay, so a block cannot be used to rejoin. Saves; the caller owns the transaction. keep-comment: why only Joined and Interested go
    public static async Task LeaveAsync(StigViddDbContext context, int blockerUserId, int organizerUserId, CancellationToken ctoken)
    {
        context.EventInvitations.RemoveRange(await context.EventInvitations
            .Where(i => i.InvitedUserId == blockerUserId
                && i.Status == EventInvitationStatus.Pending
                && context.EventParticipants.Any(o => o.EventId == i.EventId
                    && o.UserId == organizerUserId
                    && o.Role == EventParticipantRole.Organizer))
            .ToListAsync(ctoken));
        await context.SaveChangesAsync(ctoken);

        var eventIds = await context.EventParticipants
            .Where(p => p.UserId == blockerUserId
                && p.Status != EventParticipantStatus.Removed
                && context.EventParticipants.Any(o => o.EventId == p.EventId
                    && o.UserId == organizerUserId
                    && o.Role == EventParticipantRole.Organizer))
            .Select(p => p.EventId)
            .OrderBy(id => id)
            .ToListAsync(ctoken);

        if (eventIds.Count == 0)
            return;

        foreach (var eventId in eventIds)
            await EventCounts.LockAsync(context, eventId, ctoken);

        context.EventParticipants.RemoveRange(await context.EventParticipants
            .Where(p => p.UserId == blockerUserId && eventIds.Contains(p.EventId))
            .ToListAsync(ctoken));
        await context.SaveChangesAsync(ctoken);

        foreach (var eventId in eventIds)
            await EventCounts.RecountAsync(context, eventId, ctoken);

        await context.SaveChangesAsync(ctoken);
    }
}
