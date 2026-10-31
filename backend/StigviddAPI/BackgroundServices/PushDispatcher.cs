// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Core.Services;

namespace StigviddAPI.BackgroundServices;

public class PushDispatcher : BackgroundService
{
    private readonly IPushQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMaintenanceGate _maintenance;
    private readonly ILogger<PushDispatcher> _logger;

    public PushDispatcher(
        IPushQueue queue,
        IServiceScopeFactory scopeFactory,
        IMaintenanceGate maintenance,
        ILogger<PushDispatcher> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _maintenance = maintenance;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                await _maintenance.WaitWhilePausedAsync(stoppingToken);

                using var scope = _scopeFactory.CreateScope();
                var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();

                await push.SendToUsersAsync(message.UserIds, message.Title, message.Body, message.Data, stoppingToken, message.FromUserId);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PushDispatcher: A push to {Count} user(s) could not be sent.", message.UserIds.Count);
            }
        }
    }
}
