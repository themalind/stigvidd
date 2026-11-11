// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json;
using Core.Interfaces.Repositories;
using Core.Logging;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Core.DomainEvents;

public class DomainEventProcessor : IDomainEventProcessor
{
    private const int DefaultMaxAttempts = 5;
    private const int DefaultHandlerTimeoutSeconds = 60;

    private readonly IDomainEventRepository _repository;
    private readonly DomainEventRegistry _registry;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<DomainEventProcessor> _logger;
    private readonly int _maxAttempts;
    private readonly TimeSpan _handlerTimeout;

    public DomainEventProcessor(
        IDomainEventRepository repository,
        DomainEventRegistry registry,
        IServiceScopeFactory scopes,
        IConfiguration configuration,
        ILogger<DomainEventProcessor> logger)
    {
        _repository = repository;
        _registry = registry;
        _scopes = scopes;
        _logger = logger;

        _maxAttempts = DomainEventConfig.ReadPositive(configuration, "DomainEvents:MaxAttempts", DefaultMaxAttempts);
        _handlerTimeout = TimeSpan.FromSeconds(
            DomainEventConfig.ReadPositive(configuration, "DomainEvents:HandlerTimeoutSeconds", DefaultHandlerTimeoutSeconds));
    }

    // Returns how many rows were due, not how many this call won, so a skipped row does not end a drain early. keep-comment: the dispatch loop keys on it
    public async Task<int> ProcessDueAsync(int batchSize, CancellationToken ctoken)
    {
        var claim = await _repository.ClaimDueAsync(batchSize, ctoken);

        if (!claim.IsSuccess)
        {
            _logger.LogError("DomainEventProcessor: Could not claim due events. Status: {status}", claim.Status);
            return 0;
        }

        foreach (var record in claim.Value.Claimed)
        {
            ctoken.ThrowIfCancellationRequested();

            try
            {
                await ProcessOneAsync(record, ctoken);
            }
            catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // One bad row must not strand the rest of the claimed batch as Processing. keep-comment: found by review
                _logger.LogError(ex, "DomainEventProcessor: Event {identifier} failed unexpectedly.", record.Identifier);

                var error = $"{ex.GetType().Name}: {LogRedaction.ScrubEmails(ex.Message)}";
                var failed = await _repository.MarkFailedAsync(record.Id, error, [.. ParseCompleted(record.CompletedHandlers)], permanent: false, _maxAttempts, ctoken);

                LogIfParked(record, failed);
            }
        }

        return claim.Value.DueCount;
    }

    private async Task ProcessOneAsync(DomainEventRecord record, CancellationToken ctoken)
    {
        if (!_registry.TryGet(record.EventType, out var descriptor))
        {
            await ParkAsync(record, $"Unknown event type '{record.EventType}'.", ctoken);
            return;
        }

        var @event = DomainEventSerializer.FromRecord(record, descriptor.ClrType);

        if (@event is null)
        {
            await ParkAsync(record, $"The payload could not be read as '{record.EventType}'.", ctoken);
            return;
        }

        var done = ParseCompleted(record.CompletedHandlers);
        var run = await RunHandlersAsync(descriptor.ClrType, @event, done, ctoken);

        if (run.Interrupted)
        {
            ctoken.ThrowIfCancellationRequested();

            run = run with { Errors = [.. run.Errors, $"A handler did not finish within {_handlerTimeout.TotalSeconds:0} seconds."] };
        }

        if (run.Errors.Count == 0)
        {
            var handled = await _repository.MarkHandledAsync(record.Id, run.Completed, ctoken);

            if (!handled.IsSuccess)
                _logger.LogError("DomainEventProcessor: Event {identifier} was handled but could not be marked handled; a restart may run its handlers again. Status: {status}", record.Identifier, handled.Status);

            return;
        }

        var failed = await _repository.MarkFailedAsync(record.Id, string.Join(" | ", run.Errors), run.Completed, permanent: false, _maxAttempts, ctoken);

        LogIfParked(record, failed);
    }

    // One scope per event, so a drain of many does not hold every transient disposable until the end. keep-comment: reviewed
    private async Task<HandlerRun> RunHandlersAsync(Type clrType, IDomainEvent @event, HashSet<string> done, CancellationToken ctoken)
    {
        var scope = _scopes.CreateScope();
        var abandoned = false;

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ctoken);
            timeout.CancelAfter(_handlerTimeout);

            var invocation = _registry.InvokerFor(clrType).InvokeAsync(scope.ServiceProvider, @event, done, timeout.Token);

            // A handler that ignores its token would wedge the only dispatcher, so it is abandoned a grace period after the timeout. keep-comment: cancellation is cooperative
            using var grace = CancellationTokenSource.CreateLinkedTokenSource(ctoken);
            var winner = await Task.WhenAny(invocation, Task.Delay(_handlerTimeout + _handlerTimeout / 2, grace.Token));
            await grace.CancelAsync();

            if (winner == invocation)
                return await invocation;

            ctoken.ThrowIfCancellationRequested();

            abandoned = true;
            _ = invocation.ContinueWith(
                finished =>
                {
                    _ = finished.Exception;
                    DisposeQuietly(scope);
                },
                TaskScheduler.Default);

            return new HandlerRun([.. done], [], Interrupted: true);
        }
        finally
        {
            if (!abandoned)
                DisposeQuietly(scope);
        }
    }

    // A handler's Dispose throwing must not turn a handled event into a failure. keep-comment: found by review
    private void DisposeQuietly(IServiceScope scope)
    {
        try
        {
            scope.Dispose();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DomainEventProcessor: Disposing a handler scope failed.");
        }
    }

    private async Task ParkAsync(DomainEventRecord record, string error, CancellationToken ctoken)
    {
        var failed = await _repository.MarkFailedAsync(record.Id, error, [], permanent: true, _maxAttempts, ctoken);

        LogIfParked(record, failed);
    }

    private void LogIfParked(DomainEventRecord record, RepositoryResult<DomainEventRecord> failed)
    {
        if (!failed.IsSuccess)
        {
            _logger.LogError("DomainEventProcessor: Could not record the failure of event {identifier}. Status: {status}", record.Identifier, failed.Status);
            return;
        }

        if (failed.Value.Status == DomainEventStatus.Failed)
        {
            _logger.LogError(
                "DomainEventProcessor: Giving up on event {identifier} ({type}) after {attempts} attempt(s): {error}",
                failed.Value.Identifier, failed.Value.EventType, failed.Value.Attempts, failed.Value.LastError);
        }
    }

    private static HashSet<string> ParseCompleted(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            return [.. JsonSerializer.Deserialize<string[]>(json) ?? []];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
