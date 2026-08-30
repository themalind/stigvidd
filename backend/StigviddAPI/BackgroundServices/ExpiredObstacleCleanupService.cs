// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;

namespace StigviddAPI.BackgroundServices;

// Deletes obstacle reports past their retention period, on every trail, on a fixed schedule.
public class ExpiredObstacleCleanupService : BackgroundService
{
    private const int DefaultIntervalHours = 24;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiredObstacleCleanupService> _logger;
    private readonly TimeSpan _interval;

    public ExpiredObstacleCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<ExpiredObstacleCleanupService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var hours = int.TryParse(configuration["ObstacleRetention:CleanupIntervalHours"], out var configured)
            ? configured
            : DefaultIntervalHours;

        _interval = TimeSpan.FromHours(hours);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);

        // Once at startup, then on the interval
        do
        {
            await RunCleanupAsync(stoppingToken);
        }
        while (await WaitForNextTickAsync(timer, stoppingToken));
    }

    private async Task RunCleanupAsync(CancellationToken stoppingToken)
    {
        try
        {
            // A hosted service is a singleton, so the repository is resolved per run.
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<ITrailObstacleRepository>();

            var result = await repository.DeleteExpiredObstaclesAsync(stoppingToken);

            if (!result.IsSuccess)
            {
                _logger.LogWarning("ExpiredObstacleCleanupService: The cleanup run failed. Retrying at the next interval.");
                return;
            }

            if (result.Value > 0)
                _logger.LogInformation("ExpiredObstacleCleanupService: Deleted {count} expired obstacle reports.", result.Value);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down
        }
        catch (Exception ex)
        {
            // Swallowed so a failed run does not stop the host; the next tick retries.
            _logger.LogError(ex, "ExpiredObstacleCleanupService: Unexpected error during cleanup.");
        }
    }

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
