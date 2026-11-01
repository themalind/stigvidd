// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Events;

namespace StigviddAPI.BackgroundServices;

// Assumes one API instance, like the mail dispatcher. keep-comment: claiming is read-then-update and the signal is per-process
public class DomainEventDispatcher(DomainEventDispatchLoop loop, ILogger<DomainEventDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await loop.RecoverAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await loop.RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "DomainEventDispatcher: a processing pass failed.");

                // Without a pause a persistent failure would spin the loop. keep-comment: RunOnceAsync can throw before it waits
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}
