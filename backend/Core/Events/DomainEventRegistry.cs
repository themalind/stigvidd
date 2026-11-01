// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using Infrastructure.Data.Entities;

namespace Core.Events;

public sealed record DomainEventDescriptor(string Name, Type ClrType);

public sealed class DomainEventRegistry
{
    private readonly Dictionary<string, DomainEventDescriptor> _byName;
    private readonly Dictionary<Type, DomainEventDescriptor> _byType;
    private readonly Dictionary<Type, IDomainEventHandlerInvoker> _invokers;

    private DomainEventRegistry(
        Dictionary<string, DomainEventDescriptor> byName,
        Dictionary<Type, DomainEventDescriptor> byType,
        Dictionary<Type, IDomainEventHandlerInvoker> invokers)
    {
        _byName = byName;
        _byType = byType;
        _invokers = invokers;
    }

    public static DomainEventRegistry Scan(params Assembly[] assemblies) =>
        FromTypes(assemblies.SelectMany(a => a.GetTypes()));

    // Throws on a duplicate name or a missing attribute, so the host fails to start rather than a row failing later. keep-comment: why this is eager
    public static DomainEventRegistry FromTypes(IEnumerable<Type> types)
    {
        var byName = new Dictionary<string, DomainEventDescriptor>(StringComparer.Ordinal);
        var byType = new Dictionary<Type, DomainEventDescriptor>();
        var invokers = new Dictionary<Type, IDomainEventHandlerInvoker>();

        foreach (var type in types.Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IDomainEvent).IsAssignableFrom(t)))
        {
            var attribute = type.GetCustomAttribute<DomainEventNameAttribute>(inherit: false)
                ?? throw new InvalidOperationException($"{type.FullName} is an IDomainEvent without a [DomainEventName].");

            if (attribute.Name.Length > DomainEventRecord.MaxKeyLength)
                throw new InvalidOperationException($"Domain event name '{attribute.Name}' on {type.FullName} is longer than the {DomainEventRecord.MaxKeyLength} characters the column holds.");

            var descriptor = new DomainEventDescriptor(attribute.Name, type);

            if (!byName.TryAdd(attribute.Name, descriptor))
                throw new InvalidOperationException($"Domain event name '{attribute.Name}' is used by both {byName[attribute.Name].ClrType.FullName} and {type.FullName}.");

            byType.Add(type, descriptor);
            invokers.Add(type, Activator.CreateInstance(typeof(DomainEventHandlerInvoker<>).MakeGenericType(type)) as IDomainEventHandlerInvoker
                ?? throw new InvalidOperationException($"Could not build a handler invoker for {type.FullName}."));
        }

        return new DomainEventRegistry(byName, byType, invokers);
    }

    public DomainEventDescriptor Describe(Type eventType) =>
        _byType.TryGetValue(eventType, out var descriptor)
            ? descriptor
            : throw new InvalidOperationException($"{eventType.FullName} is not a registered domain event.");

    public bool TryGet(string name, [NotNullWhen(true)] out DomainEventDescriptor? descriptor) =>
        _byName.TryGetValue(name, out descriptor);

    internal IDomainEventHandlerInvoker InvokerFor(Type eventType) => _invokers[eventType];
}
