// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;

namespace Core.DomainEvents;

public static class DomainEventDbContextExtensions
{
    // Call before SaveChangesAsync so the event commits with the write, then IDomainEventSignal.Poke() AFTER the commit. keep-comment: write-then-signal ordering
    public static DomainEventRecord AddDomainEvent(this StigViddDbContext context, IDomainEvent @event, string? entityKey = null)
    {
        var record = DomainEventSerializer.ToRecord(@event, entityKey);
        context.DomainEvents.Add(record);
        return record;
    }
}
