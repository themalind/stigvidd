// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace Core.Events;

internal sealed record HandlerRun(IReadOnlyList<string> Completed, IReadOnlyList<string> Errors, bool Interrupted = false);

internal interface IDomainEventHandlerInvoker
{
    Task<HandlerRun> InvokeAsync(IServiceProvider services, IDomainEvent @event, IReadOnlySet<string> done, CancellationToken ctoken);
}

internal sealed class DomainEventHandlerInvoker<TEvent> : IDomainEventHandlerInvoker where TEvent : IDomainEvent
{
    public async Task<HandlerRun> InvokeAsync(IServiceProvider services, IDomainEvent @event, IReadOnlySet<string> done, CancellationToken ctoken)
    {
        var completed = new List<string>(done);
        var errors = new List<string>();

        if (@event is not TEvent typed)
            return new HandlerRun(completed, [$"Event is not a {typeof(TEvent).Name}."]);

        // Every handler runs even when an earlier one failed: they are independent, and one must not wait out another's backoff. keep-comment: deliberate, reviewed
        foreach (var handler in services.GetServices<IDomainEventHandler<TEvent>>())
        {
            var name = handler.GetType().FullName ?? handler.GetType().Name;

            if (done.Contains(name))
                continue;

            try
            {
                var result = await handler.HandleAsync(typed, ctoken);

                if (result.IsFailure)
                    errors.Add($"{name}: {LogRedaction.ScrubEmails(result.Message?.ResultMessage)}");
                else
                    completed.Add(name);
            }
            catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
            {
                // Hands back what already succeeded; the processor decides whether this was shutdown or a timeout. keep-comment: a timeout must not forget earlier successes
                return new HandlerRun(completed, errors, Interrupted: true);
            }
            catch (Exception ex)
            {
                errors.Add($"{name}: {ex.GetType().Name}: {LogRedaction.ScrubEmails(ex.Message)}");
            }
        }

        return new HandlerRun(completed, errors);
    }
}
