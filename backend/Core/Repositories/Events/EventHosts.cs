// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Events;

public static class EventHosts
{
    // Whether the user is a joined organizer or co-host of the event, as EventMembership.IsHost. keep-comment: the two rules must match
    public static async Task<bool> IsHostAsync(StigViddDbContext context, int eventId, int? userId, CancellationToken ctoken)
    {
        if (userId is null)
        {
            return false;
        }

        return await context.EventParticipants.AnyAsync(p => p.EventId == eventId
            && p.UserId == userId
            && p.Status == EventParticipantStatus.Joined
            && (p.Role == EventParticipantRole.Organizer || p.Role == EventParticipantRole.CoHost), ctoken);
    }
}
