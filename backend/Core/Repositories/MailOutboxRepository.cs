// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class MailOutboxRepository : IMailOutboxRepository
{
    // 1, 2, 4, 8, 16 minutes. Capped so a long outage cannot push the next attempt past the
    // point anyone still wants the mail.
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(16);

    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<MailOutboxRepository> _logger;

    public MailOutboxRepository(
        IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<MailOutboxRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<OutboxEmail>> AddAsync(OutboxEmail email, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.OutboxEmails.Add(email);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<OutboxEmail>.Success(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: AddAsync -> Something went wrong when queueing a mail to {to}.", email.ToAddress);
            return RepositoryResult<OutboxEmail>.Error();
        }
    }

    public async Task<RepositoryResult<OutboxEmail>> ClaimAsync(int id, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Tracked, not AsNoTracking: this read is the first half of the claim.
            var email = await context.OutboxEmails.FirstOrDefaultAsync(e => e.Id == id, ctoken);

            if (email is null)
                return RepositoryResult<OutboxEmail>.NotFound();

            // Already claimed, already sent, or already given up on. This is the normal path
            // for a duplicate queue signal, not an error.
            if (email.Status != OutboxEmailStatus.Pending)
                return RepositoryResult<OutboxEmail>.Conflict();

            email.Status = OutboxEmailStatus.Sending;
            email.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<OutboxEmail>.Success(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: ClaimAsync -> Something went wrong when claiming mail {id}.", id);
            return RepositoryResult<OutboxEmail>.Error();
        }
    }

    public async Task<RepositoryResult> ReleaseAsync(int id, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var email = await context.OutboxEmails.FirstOrDefaultAsync(e => e.Id == id, ctoken);
            if (email is null)
                return RepositoryResult.NotFound();

            // Attempts, NextAttemptAt and LastError are deliberately untouched: this row was
            // claimed and handed straight back, not tried.
            email.Status = OutboxEmailStatus.Pending;
            email.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: ReleaseAsync -> Something went wrong when releasing mail {id}.", id);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> MarkSentAsync(int id, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var email = await context.OutboxEmails.FirstOrDefaultAsync(e => e.Id == id, ctoken);
            if (email is null)
                return RepositoryResult.NotFound();

            email.Status = OutboxEmailStatus.Sent;
            email.SentAt = DateTime.UtcNow;
            email.LastError = null;
            email.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: MarkSentAsync -> Something went wrong when marking mail {id} sent.", id);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<OutboxEmail>> MarkFailedAsync(
        int id, string error, bool permanent, int maxAttempts, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var email = await context.OutboxEmails.FirstOrDefaultAsync(e => e.Id == id, ctoken);
            if (email is null)
                return RepositoryResult<OutboxEmail>.NotFound();

            email.Attempts += 1;
            email.LastError = error;
            email.LastUpdatedAt = DateTime.UtcNow;

            if (permanent || email.Attempts >= maxAttempts)
            {
                // Park it. A 5xx reply means the server has told us the message itself is
                // unacceptable, so further attempts buy the same answer more slowly.
                email.Status = OutboxEmailStatus.Failed;
            }
            else
            {
                email.Status = OutboxEmailStatus.Pending;
                email.NextAttemptAt = DateTime.UtcNow + BackoffFor(email.Attempts);
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<OutboxEmail>.Success(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: MarkFailedAsync -> Something went wrong when recording a failure for mail {id}.", id);
            return RepositoryResult<OutboxEmail>.Error();
        }
    }

    public async Task<RepositoryResult<int>> ResetInterruptedAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var interrupted = await context.OutboxEmails
                .Where(e => e.Status == OutboxEmailStatus.Sending)
                .ToListAsync(ctoken);

            foreach (var email in interrupted)
            {
                email.Status = OutboxEmailStatus.Pending;
                email.LastUpdatedAt = DateTime.UtcNow;
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<int>.Success(interrupted.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: ResetInterruptedAsync -> Something went wrong when resetting interrupted mail.");
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<int>>> GetPendingIdsAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var ids = await context.OutboxEmails
                .AsNoTracking()
                .Where(e => e.Status == OutboxEmailStatus.Pending)
                .OrderBy(e => e.Id)
                .Select(e => e.Id)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<int>>.Success(ids);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: GetPendingIdsAsync -> Something went wrong when listing pending mail.");
            return RepositoryResult<IReadOnlyCollection<int>>.Error();
        }
    }

    // Attempt 1 -> 1 min, 2 -> 2, 3 -> 4, 4 -> 8, 5 -> 16.
    private static TimeSpan BackoffFor(int attempts)
    {
        var minutes = Math.Pow(2, Math.Max(0, attempts - 1));
        var backoff = TimeSpan.FromMinutes(minutes);

        return backoff > MaxBackoff ? MaxBackoff : backoff;
    }
}
