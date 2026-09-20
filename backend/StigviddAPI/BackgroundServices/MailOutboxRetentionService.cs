// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;

namespace StigviddAPI.BackgroundServices;

// Holds OutboxEmails to a retention rule, on a timer, so storage limitation is not something an
// operator has to remember. Three things, in the order they stop mattering:
//
//   1. Sent mail is deleted after MailOutbox:SentRetentionDays. It is a delivery receipt.
//   2. Failed and Cancelled mail is deleted after MailOutbox:SettledRetentionDays. Longer,
//      because it is the diagnostic record AND the retryable one.
//   3. The BODIES of settled mail are cleared after MailOutbox:BodyRetentionHours, well before
//      the row itself goes. A body carries a nickname and, for verify-email and reset-password,
//      a live token URL; it is only needed while the mail can still usefully be sent.
//
// Sent bodies are not this service's business -- MarkSentAsync clears those as it marks them,
// since a sent mail can never be retried.
//
// Companion to the manual purge in the admin UI, which stays as the "sooner than this" tool.
public class MailOutboxRetentionService : BackgroundService
{
    private const int DefaultIntervalHours = 1;
    private const int DefaultSentRetentionDays = 7;
    private const int DefaultSettledRetentionDays = 30;
    private const int DefaultBodyRetentionHours = 24;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MailOutboxRetentionService> _logger;
    private readonly TimeSpan _interval;
    private readonly int _sentRetentionDays;
    private readonly int _settledRetentionDays;
    private readonly int _bodyRetentionHours;

    public MailOutboxRetentionService(
        IServiceScopeFactory scopeFactory,
        ILogger<MailOutboxRetentionService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        // The interval is an hour rather than the obstacle sweep's day on purpose. It is the
        // error bar on every window below: a body whose retention is 24 hours actually lives up
        // to 24 + one interval, and the point of that 24 is that it tracks the longest token
        // lifetime in the system. A daily tick would make it 48 and the number would mean nothing.
        _interval = TimeSpan.FromHours(
            ReadPositive(configuration, "MailOutbox:CleanupIntervalHours", DefaultIntervalHours));

        _sentRetentionDays = ReadPositive(
            configuration, "MailOutbox:SentRetentionDays", DefaultSentRetentionDays);
        _settledRetentionDays = ReadPositive(
            configuration, "MailOutbox:SettledRetentionDays", DefaultSettledRetentionDays);
        _bodyRetentionHours = ReadPositive(
            configuration, "MailOutbox:BodyRetentionHours", DefaultBodyRetentionHours);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);

        // Once at startup, then on the interval
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
            // A hosted service is a singleton, so the repository is resolved per run.
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IMailOutboxRepository>();

            var now = DateTime.UtcNow;

            // Redaction first. If the delete below fails, the bodies are still gone -- which is
            // the half that matters, since the row without its body carries an address and a
            // subject and the body carries a live link.
            var redacted = await repository.RedactBodiesBeforeAsync(
                now.AddHours(-_bodyRetentionHours), stoppingToken);

            if (!redacted.IsSuccess)
                _logger.LogWarning("MailOutboxRetentionService: Redacting settled mail bodies failed. Retrying at the next interval.");
            else if (redacted.Value > 0)
                _logger.LogInformation("MailOutboxRetentionService: Cleared the bodies of {count} settled mails.", redacted.Value);

            var sent = await repository.PurgeSentBeforeAsync(
                now.AddDays(-_sentRetentionDays), stoppingToken);

            if (!sent.IsSuccess)
                _logger.LogWarning("MailOutboxRetentionService: Purging sent mail failed. Retrying at the next interval.");
            else if (sent.Value > 0)
                _logger.LogInformation("MailOutboxRetentionService: Deleted {count} sent mails past the retention period.", sent.Value);

            var settled = await repository.PurgeSettledBeforeAsync(
                now.AddDays(-_settledRetentionDays), stoppingToken);

            if (!settled.IsSuccess)
                _logger.LogWarning("MailOutboxRetentionService: Purging settled mail failed. Retrying at the next interval.");
            else if (settled.Value > 0)
                _logger.LogInformation("MailOutboxRetentionService: Deleted {count} failed or cancelled mails past the retention period.", settled.Value);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down
        }
        catch (Exception ex)
        {
            // Swallowed so a failed run does not stop the host; the next tick retries.
            _logger.LogError(ex, "MailOutboxRetentionService: Unexpected error during the retention run.");
        }
    }

    // A zero or negative window would mean "delete everything, now". Misconfiguration should
    // fall back to the documented default rather than empty the table.
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
