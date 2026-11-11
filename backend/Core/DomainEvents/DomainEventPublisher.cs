// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Microsoft.Extensions.Logging;

namespace Core.DomainEvents;

public class DomainEventPublisher(
    IDomainEventRepository repository,
    IDomainEventSignal signal,
    ILogger<DomainEventPublisher> logger) : IDomainEventPublisher
{
    public async Task<Result<string>> PublishAsync(IDomainEvent @event, CancellationToken ctoken, string? entityKey = null)
    {
        var added = await repository.AddAsync(DomainEventSerializer.ToRecord(@event, entityKey), ctoken);

        if (!added.IsSuccess)
        {
            logger.LogError("DomainEventPublisher: PublishAsync -> Failed to store event {type}.", @event.GetType().Name);
            return Result.Fail<string>(new Message(500, "An error occurred while storing the event."));
        }

        // Only now signal: the dispatcher must be able to read the committed row. keep-comment: write-then-signal
        signal.Poke();

        return Result.Ok(added.Value.Identifier);
    }
}
