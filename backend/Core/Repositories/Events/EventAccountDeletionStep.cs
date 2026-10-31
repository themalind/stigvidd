// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services.Push;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Events;

public class EventAccountDeletionStep : IAccountDeletionStep
{
    // Rows are removed and nulled by hand: in-memory SQLite on Linux applies neither cascade nor SetNull. keep-comment: why the database's own rules are not enough
    public async Task<AccountDeletionEffects> RunAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        var pushes = new List<PushMessage>();

        // In id order, so two deletions sharing events cannot deadlock. keep-comment: why sorted
        var touched = await context.EventParticipants
            .Where(p => p.UserId == userId)
            .Select(p => p.EventId)
            .OrderBy(id => id)
            .ToListAsync(ctoken);

        foreach (var eventId in touched)
            await EventCounts.LockAsync(context, eventId, ctoken);

        var organized = await context.EventParticipants
            .Where(p => p.UserId == userId && p.Role == EventParticipantRole.Organizer)
            .Select(p => p.EventId)
            .ToListAsync(ctoken);

        foreach (var eventId in organized)
        {
            var handOver = await EventHandOver.RunAsync(context, eventId, userId, ctoken);

            if (handOver is not null)
                pushes.AddRange(EventPushes.ForHandOver(handOver));
        }

        var rows = await context.EventParticipants.Where(p => p.UserId == userId).ToListAsync(ctoken);
        var joined = rows.Where(p => p.Status == EventParticipantStatus.Joined).Select(p => p.EventId).ToList();
        context.EventParticipants.RemoveRange(rows);

        context.EventInvitations.RemoveRange(await context.EventInvitations.Where(i => i.InvitedUserId == userId).ToListAsync(ctoken));

        foreach (var invitation in await context.EventInvitations.Where(i => i.InvitedByUserId == userId).ToListAsync(ctoken))
            invitation.InvitedByUserId = null;

        foreach (var post in await context.EventPosts.IgnoreQueryFilters(["Moderation"]).Where(p => p.UserId == userId).ToListAsync(ctoken))
            post.UserId = null;

        await context.SaveChangesAsync(ctoken);

        foreach (var eventId in joined)
            await EventCounts.RecountAsync(context, eventId, ctoken);

        await context.SaveChangesAsync(ctoken);

        return new AccountDeletionEffects([], pushes);
    }
}
