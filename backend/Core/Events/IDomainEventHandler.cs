// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Events;

// At-least-once: a failure, an exception or a timeout retries, so a handler must be idempotent. keep-comment: contract every handler must honour
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task<Result> HandleAsync(TEvent @event, CancellationToken ctoken);
}
