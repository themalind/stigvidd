// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Events;

public static class DomainEventSerializer
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    private static readonly ConcurrentDictionary<Type, string> Names = new();

    public static DomainEventRecord ToRecord(IDomainEvent @event, string? entityKey)
    {
        var type = @event.GetType();
        var name = Names.GetOrAdd(type, t =>
            t.GetCustomAttribute<DomainEventNameAttribute>(inherit: false)?.Name
                ?? throw new InvalidOperationException($"{t.FullName} has no [DomainEventName]."));

        return new DomainEventRecord
        {
            EventType = name,
            Payload = JsonSerializer.Serialize(@event, type, Options),
            // Free text for filtering only, so an overlong one is cut rather than failing the write it rides on. keep-comment: the column holds 100
            EntityKey = entityKey is { Length: > DomainEventRecord.MaxKeyLength } ? entityKey[..DomainEventRecord.MaxKeyLength] : entityKey,
            TraceId = Activity.Current?.TraceId.ToString(),
            Status = DomainEventStatus.Pending,
            NextAttemptAt = DateTime.UtcNow,
        };
    }

    public static IDomainEvent? FromRecord(DomainEventRecord record, Type clrType)
    {
        try
        {
            return JsonSerializer.Deserialize(record.Payload, clrType, Options) as IDomainEvent;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
