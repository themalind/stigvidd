// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Enums;

namespace StigviddAPI.BackgroundServices;

// Drains the mail outbox, off the request path and without polling.
//
// The in-memory queue says which row to look at; the OutboxEmails table says what is actually
// outstanding. That split is deliberate and the startup sweep below is what makes it safe:
// every Pending row is re-signalled on start, so a signal lost to a crash or a restart costs
// latency rather than a mail. Assumes one API instance — claiming is a read-then-update and
// the queue is per-process.
public class MailOutboxDispatcher : BackgroundService
{
    private const int DefaultMaxAttempts = 5;

    private readonly IMailOutboxQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MailOutboxDispatcher> _logger;
    private readonly int _maxAttempts;

    public MailOutboxDispatcher(
        IMailOutboxQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<MailOutboxDispatcher> logger,
        IConfiguration configuration)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;

        _maxAttempts = int.TryParse(configuration["MailOutbox:MaxAttempts"], out var configured)
            ? configured
            : DefaultMaxAttempts;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecoverAsync(stoppingToken);

        await foreach (var id in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                await ProcessAsync(id, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Shutting down. Whatever was in flight is still Pending or Sending in the
                // table, and the next start picks it up.
                return;
            }
            catch (Exception ex)
            {
                // Swallowed so one bad message does not stop the dispatcher for every later
                // one. The row keeps its status; the startup sweep is the backstop.
                _logger.LogError(ex, "MailOutboxDispatcher: Mail {id} could not be processed.", id);
            }
        }
    }

    // Reconciles the queue against the journal. Runs once, before anything is dequeued.
    private async Task RecoverAsync(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IMailOutboxRepository>();

            // A row left Sending has no worker holding it: the queue died with the process.
            var reset = await repository.ResetInterruptedAsync(stoppingToken);
            if (reset.IsSuccess && reset.Value > 0)
                _logger.LogInformation("MailOutboxDispatcher: Reset {count} mail(s) interrupted by a restart.", reset.Value);

            // Re-signal everything outstanding — interrupted, never signalled, or part way
            // through a backoff when the process died. Rows not yet due are rescheduled
            // rather than sent, in ProcessAsync.
            var pending = await repository.GetPendingIdsAsync(stoppingToken);
            if (!pending.IsSuccess)
            {
                _logger.LogError("MailOutboxDispatcher: Could not list pending mail at startup; queued mail will wait for the next restart.");
                return;
            }

            foreach (var id in pending.Value)
                _queue.Enqueue(id);

            if (pending.Value.Count > 0)
                _logger.LogInformation("MailOutboxDispatcher: Re-queued {count} pending mail(s) from the outbox.", pending.Value.Count);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down
        }
        catch (Exception ex)
        {
            // Never let recovery stop the dispatcher: new mail must still go out.
            _logger.LogError(ex, "MailOutboxDispatcher: Startup recovery failed.");
        }
    }

    private async Task ProcessAsync(int id, CancellationToken stoppingToken)
    {
        // A hosted service is a singleton, so the scoped repository is resolved per message.
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IMailOutboxRepository>();
        var sender = scope.ServiceProvider.GetRequiredService<IMailSender>();

        var claim = await repository.ClaimAsync(id, stoppingToken);

        // Conflict is the ordinary outcome of a duplicate signal — someone else has it, or it
        // is already Sent or Failed. Not an error, and nothing to log.
        if (claim.Status == RepositoryResultStatus.Conflict)
            return;

        if (!claim.IsSuccess)
        {
            _logger.LogError("MailOutboxDispatcher: Could not claim mail {id}. Status: {status}", id, claim.Status);
            return;
        }

        var email = claim.Value;

        // The startup sweep re-queues rows whose backoff has not expired, so a claimed row is
        // not necessarily due. Put it back and wait out the remainder.
        var wait = email.NextAttemptAt - DateTime.UtcNow;
        if (wait > TimeSpan.Zero)
        {
            var released = await repository.ReleaseAsync(id, stoppingToken);
            if (released.IsSuccess)
                ScheduleRetry(id, wait, stoppingToken);

            return;
        }

        var sent = await sender.SendAsync(email, stoppingToken);

        if (sent.Success)
        {
            await repository.MarkSentAsync(id, stoppingToken);
            return;
        }

        var failed = await repository.MarkFailedAsync(
            id, sent.Error ?? "Unknown error.", sent.Permanent, _maxAttempts, stoppingToken);

        if (!failed.IsSuccess)
        {
            _logger.LogError("MailOutboxDispatcher: Could not record the failure of mail {id}.", id);
            return;
        }

        if (failed.Value.Status == OutboxEmailStatus.Failed)
        {
            _logger.LogError(
                "MailOutboxDispatcher: Giving up on mail {identifier} to {to} after {attempts} attempt(s): {error}",
                failed.Value.Identifier, failed.Value.ToAddress, failed.Value.Attempts, failed.Value.LastError);
            return;
        }

        ScheduleRetry(id, failed.Value.NextAttemptAt - DateTime.UtcNow, stoppingToken);
    }

    // Best-effort in-process timer. If the process dies before it fires nothing is lost: the
    // row is still Pending and RecoverAsync re-queues it on the next start. That is precisely
    // why the table and not the channel is the source of truth — this may be skipped, the
    // journal may not.
    private void ScheduleRetry(int id, TimeSpan delay, CancellationToken stoppingToken)
    {
        if (delay < TimeSpan.Zero)
            delay = TimeSpan.Zero;

        _ = Task.Delay(delay, stoppingToken)
            .ContinueWith(
                _ => _queue.Enqueue(id),
                stoppingToken,
                TaskContinuationOptions.OnlyOnRanToCompletion,
                TaskScheduler.Default);
    }
}
