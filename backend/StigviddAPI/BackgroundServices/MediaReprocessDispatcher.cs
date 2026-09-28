// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;

namespace StigviddAPI.BackgroundServices;

// Same shape as MailOutboxDispatcher, minus the retry/backoff ladder — WebDavService already
// retries its own transient network failures, so an item gets one attempt here.
public class MediaReprocessDispatcher : BackgroundService
{
    private readonly IMediaReprocessQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MediaReprocessDispatcher> _logger;

    public MediaReprocessDispatcher(
        IMediaReprocessQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<MediaReprocessDispatcher> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverAsync(stoppingToken);

        await foreach (var itemId in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(itemId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MediaReprocessDispatcher: Item {id} could not be processed.", itemId);
            }
        }
    }

    private async Task RecoverAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IMediaReprocessRepository>();

            var reset = await repository.ResetInterruptedAsync(stoppingToken);
            if (reset.IsSuccess && reset.Value > 0)
                _logger.LogInformation("MediaReprocessDispatcher: Reset {count} item(s) interrupted by a restart.", reset.Value);

            var pending = await repository.GetPendingItemIdsAsync(stoppingToken);
            if (!pending.IsSuccess)
            {
                _logger.LogError("MediaReprocessDispatcher: Could not list pending items at startup; queued work will wait for the next restart.");
                return;
            }

            foreach (var id in pending.Value)
                _queue.Enqueue(id);

            if (pending.Value.Count > 0)
                _logger.LogInformation("MediaReprocessDispatcher: Re-queued {count} pending item(s).", pending.Value.Count);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessDispatcher: Startup recovery failed.");
        }
    }

    private async Task ProcessAsync(int itemId, CancellationToken stoppingToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var processor = scope.ServiceProvider.GetRequiredService<MediaReprocessItemProcessor>();

        await processor.ProcessAsync(itemId, stoppingToken);
    }
}
