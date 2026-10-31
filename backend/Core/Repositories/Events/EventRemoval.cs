// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Core.Repositories.Events;

// The one way an event row goes, for the organizer's delete and for an upheld report. Never saves. keep-comment: two callers, one set of rules
public static class EventRemoval
{
    // Children are removed by hand: in-memory SQLite on Linux does not cascade them. keep-comment: why not rely on Cascade
    public static async Task<DeletedEvent?> RemoveAsync(StigViddDbContext context, Expression<Func<Event, bool>> which, int? actingUserId, DateTime now, CancellationToken ctoken)
    {
        var existing = await context.Events
            .Include(e => e.Participants)
            .Include(e => e.Invitations)
            .Include(e => e.Image)
            .Include(e => e.Route)
            .FirstOrDefaultAsync(which, ctoken);

        if (existing is null)
            return null;

        var notify = existing.Status == EventStatus.Published && existing.PastAfter > now
            ? ToNotifyOnCancel(existing.Participants, actingUserId)
            : [];

        context.EventPosts.RemoveRange(await context.EventPosts.IgnoreQueryFilters(["Moderation"]).Where(p => p.EventId == existing.Id).ToListAsync(ctoken));
        context.EventParticipants.RemoveRange(existing.Participants);
        context.EventInvitations.RemoveRange(existing.Invitations);
        if (existing.Image is not null)
            context.EventImages.Remove(existing.Image);
        if (existing.Route is not null)
            context.EventRoutes.Remove(existing.Route);

        context.Events.Remove(existing);

        return new DeletedEvent(existing.Identifier, existing.Title, existing.StartsAt, existing.Image?.ImageUrl, notify);
    }

    // Joined and Interested hear about a cancellation; whoever caused it does not. keep-comment: shared by cancel, delete and hand-over
    public static List<int> ToNotifyOnCancel(IEnumerable<EventParticipant> participants, int? actingUserId)
    {
        return participants
            .Where(p => p.UserId != actingUserId
                && p.Status is EventParticipantStatus.Joined or EventParticipantStatus.Interested)
            .Select(p => p.UserId)
            .ToList();
    }
}
