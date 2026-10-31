// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace Core.Repositories.Events;

// keep-comment: the tests run LockAsync on SQLite and InMemory only, where it does nothing; check a change against PostgreSQL (docs/notes/raw-sql-needs-a-postgres-check-the-sqlite-tests-cannot-give.md)
public static class EventCounts
{
    private const string NpgsqlProvider = "Npgsql.EntityFrameworkCore.PostgreSQL";

    // Call first in the transaction: a join takes this row lock with its increment, so every read after it sees that join committed. keep-comment: without it a recount overwrites a concurrent join's +1
    public static async Task LockAsync(StigViddDbContext context, int eventId, CancellationToken ctoken)
    {
        if (context.Database.ProviderName != NpgsqlProvider)
            return;

        var sqlHelper = context.GetService<ISqlGenerationHelper>();
        var table = sqlHelper.DelimitIdentifier("Events", context.Model.GetDefaultSchema());
        var id = sqlHelper.DelimitIdentifier("Id");

        await context.Database.ExecuteSqlRawAsync("SELECT 1 FROM " + table + " WHERE " + id + " = {0} FOR UPDATE", [eventId], ctoken);
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
