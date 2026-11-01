// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;

namespace StigviddAPI.BackgroundServices;

public class DomainEventRetentionService : BackgroundService
{
    private const int DefaultIntervalHours = 24;
    private const int DefaultRetentionDays = 90;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMaintenanceGate _maintenance;
    private readonly ILogger<DomainEventRetentionService> _logger;
    private readonly TimeSpan _interval;
    private readonly int _retentionDays;

    public DomainEventRetentionService(
        IServiceScopeFactory scopeFactory,
        IMaintenanceGate maintenance,
        ILogger<DomainEventRetentionService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _maintenance = maintenance;
        _logger = logger;

        _interval = TimeSpan.FromHours(ReadPositive(configuration, "DomainEvents:RetentionIntervalHours", DefaultIntervalHours));
        _retentionDays = ReadPositive(configuration, "DomainEvents:RetentionDays", DefaultRetentionDays);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);

        do
        {
            await RunRetentionAsync(stoppingToken);
        }
        while (await WaitForNextTickAsync(timer, stoppingToken));
    }

    private async Task RunRetentionAsync(CancellationToken stoppingToken)
    {
        try
        {
            await _maintenance.WaitWhilePausedAsync(stoppingToken);

            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IDomainEventRepository>();

            var purged = await repository.PurgeSettledBeforeAsync(DateTime.UtcNow.AddDays(-_retentionDays), stoppingToken);

            if (!purged.IsSuccess)
                _logger.LogWarning("DomainEventRetentionService: Purging settled events failed. Retrying at the next interval.");
            else if (purged.Value > 0)
                _logger.LogInformation("DomainEventRetentionService: Deleted {count} settled events past the retention period.", purged.Value);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRetentionService: Unexpected error during the retention run.");
        }
    }

    private static int ReadPositive(IConfiguration configuration, string key, int fallback) =>
        int.TryParse(configuration[key], out var configured) && configured > 0 ? configured : fallback;

    private static async Task<bool> WaitForNextTickAsync(PeriodicTimer timer, CancellationToken stoppingToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
