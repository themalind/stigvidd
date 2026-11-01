// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Core.Events;

// Same three rules as the mail outbox, see docs/events.md; the poke carries no id and the tick replaces per-row retry timers. keep-comment: maps this loop onto the documented rules
public class DomainEventDispatchLoop
{
    private const int DefaultPollIntervalSeconds = 30;
    private const int DefaultBatchSize = 50;
    private const int DefaultMaxAttempts = 5;

    private readonly IDomainEventSignal _signal;
    private readonly IMaintenanceGate _maintenance;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DomainEventDispatchLoop> _logger;
    private readonly TimeSpan _pollInterval;
    private readonly int _batchSize;
    private readonly int _maxAttempts;
    private bool _recovered = true;

    public DomainEventDispatchLoop(
        IDomainEventSignal signal,
        IMaintenanceGate maintenance,
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<DomainEventDispatchLoop> logger)
    {
        _signal = signal;
        _maintenance = maintenance;
        _scopeFactory = scopeFactory;
        _logger = logger;

        _pollInterval = TimeSpan.FromSeconds(
            DomainEventConfig.ReadPositive(configuration, "DomainEvents:PollIntervalSeconds", DefaultPollIntervalSeconds));
        _batchSize = DomainEventConfig.ReadPositive(configuration, "DomainEvents:BatchSize", DefaultBatchSize);
        _maxAttempts = DomainEventConfig.ReadPositive(configuration, "DomainEvents:MaxAttempts", DefaultMaxAttempts);
    }

    public async Task RecoverAsync(CancellationToken ctoken)
    {
        _recovered = false;

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IDomainEventRepository>();

            var reset = await repository.ResetInterruptedAsync(_maxAttempts, ctoken);

            if (reset.IsSuccess)
            {
                _recovered = true;

                if (reset.Value > 0)
                    _logger.LogInformation("DomainEventDispatchLoop: Reset {count} event(s) interrupted by a restart.", reset.Value);
            }
            else
            {
                _logger.LogError("DomainEventDispatchLoop: Startup recovery did not complete ({status}); it is retried on the next pass.", reset.Status);
            }
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventDispatchLoop: Startup recovery failed; it is retried on the next pass.");
        }

        // Poked even when the reset failed: due rows must still be processed. keep-comment: recovery must not block new work
        _signal.Poke();
    }

    public async Task RunOnceAsync(CancellationToken ctoken)
    {
        await _signal.WaitAsync(_pollInterval, ctoken);
        await _maintenance.WaitWhilePausedAsync(ctoken);

        // Safe mid-uptime: this loop is the only claimer and is between passes, so nothing legitimately is Processing. keep-comment: why a retried reset cannot hit live work
        if (!_recovered)
            await RecoverAsync(ctoken);

        using var scope = _scopeFactory.CreateScope();
        var processor = scope.ServiceProvider.GetRequiredService<IDomainEventProcessor>();

        int due;
        do
        {
            due = await processor.ProcessDueAsync(_batchSize, ctoken);
        }
        while (due >= _batchSize && !ctoken.IsCancellationRequested);
    }
}
