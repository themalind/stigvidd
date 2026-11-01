// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Events;

// keep-comment: no suite has row locks (SQLite runs LockAsync without locking, InMemory skips it); check a change against PostgreSQL (docs/notes/raw-sql-needs-a-postgres-check-the-sqlite-tests-cannot-give.md)
public static class EventCounts
{
    // Call first in the transaction: a no-op UPDATE takes the same row lock as a join's increment, so every read after it sees that join committed. keep-comment: without it a recount overwrites a concurrent join's +1
    public static async Task LockAsync(StigViddDbContext context, int eventId, CancellationToken ctoken)
    {
        if (!context.Database.IsRelational())
            return;

        await context.Events
            .Where(e => e.Id == eventId)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.ParticipantCount, e => e.ParticipantCount), ctoken);
    }

    // Reads saved rows, so call it after SaveChangesAsync. keep-comment: unsaved removals would still be counted
    public static async Task RecountAsync(StigViddDbContext context, int eventId, CancellationToken ctoken)
    {
        var existing = await context.Events.FirstOrDefaultAsync(e => e.Id == eventId, ctoken);

        if (existing is null)
            return;

        existing.ParticipantCount = await context.EventParticipants
            .CountAsync(p => p.EventId == eventId && p.Status == EventParticipantStatus.Joined, ctoken);
    }
}
