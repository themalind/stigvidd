// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Events;

// Joined and Interested hear about a cancellation or a change; whoever caused it does not. keep-comment: shared by cancel, delete, hand-over and edit
public static class EventAudience
{
    public static List<int> ToNotify(IEnumerable<EventParticipant> participants, int? actingUserId)
    {
        return participants
            .Where(p => p.UserId != actingUserId
                && p.Status is EventParticipantStatus.Joined or EventParticipantStatus.Interested)
            .Select(p => p.UserId)
            .ToList();
    }

    public static Task<List<int>> ToNotifyAsync(StigViddDbContext context, int eventId, int? actingUserId, CancellationToken ctoken)
    {
        return context.EventParticipants
            .Where(p => p.EventId == eventId
                && p.UserId != actingUserId
                && (p.Status == EventParticipantStatus.Joined || p.Status == EventParticipantStatus.Interested))
            .Select(p => p.UserId)
            .ToListAsync(ctoken);
    }
}
