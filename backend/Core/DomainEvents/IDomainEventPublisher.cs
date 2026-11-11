// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.DomainEvents;

public interface IDomainEventPublisher
{
    Task<Result<string>> PublishAsync(IDomainEvent @event, CancellationToken ctoken, string? entityKey = null);
}
