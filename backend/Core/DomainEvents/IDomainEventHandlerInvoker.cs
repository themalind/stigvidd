// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.DomainEvents;

internal interface IDomainEventHandlerInvoker
{
    Task<HandlerRun> InvokeAsync(IServiceProvider services, IDomainEvent @event, IReadOnlySet<string> done, CancellationToken ctoken);
}
