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

    public async Task<RepositoryResult<PagedResult<OutboxEmailSummary>>> GetPagedAsync(
        OutboxEmailStatus? status,
        string? templateKey,
        string? recipient,
        int page,
        int pageSize,
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var query = context.OutboxEmails.AsNoTracking();

            if (status.HasValue)
                query = query.Where(e => e.Status == status.Value);

            if (!string.IsNullOrWhiteSpace(templateKey))
                query = query.Where(e => e.TemplateKey == templateKey);

            if (!string.IsNullOrWhiteSpace(recipient))
            {
                // ToLower on both sides rather than a bare Contains: LIKE is case-SENSITIVE on
                // Postgres and case-INSENSITIVE on SQLite, so a bare Contains would behave one
                // way in the test suite and another in production. EF.Functions.ILike would fix
                // Postgres and throw on SQLite, which is worse.
                var needle = recipient.Trim().ToLower();
                query = query.Where(e => e.ToAddress.ToLower().Contains(needle));
            }

            var total = await query.CountAsync(ctoken);

            var items = await query
                .OrderByDescending(e => e.CreatedAt)
                .ThenByDescending(e => e.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(e => new OutboxEmailSummary(
                    e.Identifier,
                    e.ToAddress,
                    e.ToName,
                    e.Subject,
                    e.TemplateKey,
                    e.Status,
                    e.Attempts,
                    e.NextAttemptAt,
                    e.SentAt,
                    e.LastError,
                    e.CreatedAt,
                    e.LastUpdatedAt))
                .ToListAsync(ctoken);

            return RepositoryResult<PagedResult<OutboxEmailSummary>>.Success(
                new PagedResult<OutboxEmailSummary>(items, page, (page * pageSize) < total, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: GetPagedAsync -> Something went wrong when listing the outbox.");
            return RepositoryResult<PagedResult<OutboxEmailSummary>>.Error();
        }
    }

    public async Task<RepositoryResult<OutboxEmail>> GetByIdentifierAsync(
        string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var email = await context.OutboxEmails
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.Identifier == identifier, ctoken);

            return email is null
                ? RepositoryResult<OutboxEmail>.NotFound()
                : RepositoryResult<OutboxEmail>.Success(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: GetByIdentifierAsync -> Something went wrong when reading mail {identifier}.", identifier);
            return RepositoryResult<OutboxEmail>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyDictionary<OutboxEmailStatus, int>>> GetCountsByStatusAsync(
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var rows = await context.OutboxEmails
                .AsNoTracking()
                .GroupBy(e => e.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(ctoken);

            var counts = rows.ToDictionary(r => r.Status, r => r.Count);

            return RepositoryResult<IReadOnlyDictionary<OutboxEmailStatus, int>>.Success(counts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: GetCountsByStatusAsync -> Something went wrong when counting the outbox.");
            return RepositoryResult<IReadOnlyDictionary<OutboxEmailStatus, int>>.Error();
        }
    }

    public async Task<RepositoryResult<OutboxEmail>> RequeueAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var email = await context.OutboxEmails
                .FirstOrDefaultAsync(e => e.Identifier == identifier, ctoken);

            if (email is null)
                return RepositoryResult<OutboxEmail>.NotFound();

            // Sending is the one that matters: a worker holds that row right now.
            if (email.Status is not (OutboxEmailStatus.Failed or OutboxEmailStatus.Cancelled))
                return RepositoryResult<OutboxEmail>.Conflict();

            email.Status = OutboxEmailStatus.Pending;

            // The operator clicking retry IS the decision that now is the time. Leaving a spent
            // backoff in place would make the dispatcher release the row and start a timer, so
            // the click would appear to do nothing.
            email.NextAttemptAt = DateTime.UtcNow;

            // A Failed row sits at the attempt cap. Leave it there and retry buys exactly one
            // attempt with no ladder at all, which is not what retry means to someone who has
            // just fixed DNS.
            email.Attempts = 0;

            email.SentAt = null;

            // LastError is deliberately KEPT. It is the only record of why this failed, the
            // retry has not produced a new one yet, and the field is self-cleaning:
            // MarkSentAsync nulls it on success and MarkFailedAsync overwrites it on the next
            // failure.
            email.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<OutboxEmail>.Success(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: RequeueAsync -> Something went wrong when requeueing mail {identifier}.", identifier);
            return RepositoryResult<OutboxEmail>.Error();
        }
    }

    public async Task<RepositoryResult<OutboxEmail>> CancelAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var email = await context.OutboxEmails
                .FirstOrDefaultAsync(e => e.Identifier == identifier, ctoken);

            if (email is null)
                return RepositoryResult<OutboxEmail>.NotFound();

            // Only an unclaimed row can be stopped. A Sending row may already be on the wire,
            // and MarkSentAsync would overwrite the cancellation a moment later.
            if (email.Status != OutboxEmailStatus.Pending)
                return RepositoryResult<OutboxEmail>.Conflict();

            email.Status = OutboxEmailStatus.Cancelled;
            email.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<OutboxEmail>.Success(email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: CancelAsync -> Something went wrong when cancelling mail {identifier}.", identifier);
            return RepositoryResult<OutboxEmail>.Error();
        }
    }

    /// <summary>
    /// The whole "what may be purged" rule, in one expression.
    /// </summary>
    /// <remarks>
    /// Public and separate from the delete so it can be held to account by a unit test: the
    /// delete itself uses ExecuteDeleteAsync, which the EF InMemory provider the unit suite runs
    /// on does not support -- see docs/notes/executedelete-cannot-be-unit-tested-here.md.
    /// A test can still assert exactly which rows this matches.
    ///
    /// SentAt, not CreatedAt, is the clock. A row created six weeks ago but sent five minutes
    /// ago — after an outage, which is precisely when someone reaches for a purge — is recent
    /// mail. The explicit null check is not redundant either: a null in a SQL comparison is
    /// neither true nor false, and it should be a stated rule that such a row is spared.
    /// </remarks>
    public static System.Linq.Expressions.Expression<Func<OutboxEmail, bool>> Purgeable(DateTime cutoffUtc) =>
        e => e.Status == OutboxEmailStatus.Sent && e.SentAt != null && e.SentAt < cutoffUtc;

    public async Task<RepositoryResult<int>> PurgeSentBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // ExecuteDelete rather than loading and RemoveRange: the rows carry whole rendered
            // mail bodies, so materialising a large purge would pull hundreds of megabytes into
            // the change tracker to then issue one DELETE each.
            var deleted = await context.OutboxEmails
                .Where(Purgeable(cutoffUtc))
                .ExecuteDeleteAsync(ctoken);

            return RepositoryResult<int>.Success(deleted);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailOutboxRepository: PurgeSentBeforeAsync -> Something went wrong when purging sent mail.");
            return RepositoryResult<int>.Error();
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
