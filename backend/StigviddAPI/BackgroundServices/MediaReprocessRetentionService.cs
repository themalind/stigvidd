// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;

namespace StigviddAPI.BackgroundServices;

public class MediaReprocessRetentionService : BackgroundService
{
    private const int DefaultIntervalHours = 1;
    private const int DefaultSettledRetentionDays = 30;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MediaReprocessRetentionService> _logger;
    private readonly TimeSpan _interval;
    private readonly int _settledRetentionDays;

    public MediaReprocessRetentionService(
        IServiceScopeFactory scopeFactory,
        ILogger<MediaReprocessRetentionService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        _interval = TimeSpan.FromHours(
            ReadPositive(configuration, "MediaReprocess:CleanupIntervalHours", DefaultIntervalHours));

        _settledRetentionDays = ReadPositive(
            configuration, "MediaReprocess:SettledRetentionDays", DefaultSettledRetentionDays);
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
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IMediaReprocessRepository>();

            var cutoff = DateTime.UtcNow.AddDays(-_settledRetentionDays);
            var purged = await repository.PurgeSettledJobsBeforeAsync(cutoff, stoppingToken);

            if (!purged.IsSuccess)
                _logger.LogWarning("MediaReprocessRetentionService: Purging settled jobs failed. Retrying at the next interval.");
            else if (purged.Value > 0)
                _logger.LogInformation("MediaReprocessRetentionService: Deleted {count} settled batch reprocess job(s) past the retention period.", purged.Value);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MediaReprocessRetentionService: Unexpected error during the retention run.");
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
