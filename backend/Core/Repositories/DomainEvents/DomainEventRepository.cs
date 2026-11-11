// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using System.Text.Json;
using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.DomainEvents;

// Assumes one API instance: claiming is read-then-update, not SELECT ... FOR UPDATE SKIP LOCKED. keep-comment: single-instance assumption, as for the mail outbox
public class DomainEventRepository : IDomainEventRepository
{
    private const int MaxErrorLength = 2000;
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromMinutes(16);

    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<DomainEventRepository> _logger;

    public DomainEventRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<DomainEventRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    // The predicate is a separate expression so it can be unit-tested without ExecuteDelete. keep-comment: see executedelete-cannot-be-unit-tested-here
    public static Expression<Func<DomainEventRecord, bool>> PurgeableSettled(DateTime cutoffUtc)
    {
        return e => (e.Status == DomainEventStatus.Handled || e.Status == DomainEventStatus.Failed || e.Status == DomainEventStatus.Cancelled)
            && e.SettledAt != null
            && e.SettledAt < cutoffUtc;
    }

    public async Task<RepositoryResult<DomainEventRecord>> AddAsync(DomainEventRecord record, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.DomainEvents.Add(record);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<DomainEventRecord>.Success(record);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRepository: AddAsync -> Something went wrong when storing event {type}.", record.EventType);
            return RepositoryResult<DomainEventRecord>.Error();
        }
    }

    public async Task<RepositoryResult<DomainEventBatch>> ClaimDueAsync(int batchSize, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var now = DateTime.UtcNow;

            var due = await context.DomainEvents
                .Where(e => e.Status == DomainEventStatus.Pending && e.NextAttemptAt <= now)
                .OrderBy(e => e.Id)
                .Take(batchSize)
                .ToListAsync(ctoken);

            var claimed = new List<DomainEventRecord>();

            foreach (var record in due)
            {
                record.Status = DomainEventStatus.Processing;
                record.LastUpdatedAt = now;

                try
                {
                    await context.SaveChangesAsync(ctoken);
                    claimed.Add(record);
                }
                catch (DbUpdateConcurrencyException)
                {
                    // Someone else moved the row first; it is theirs now. keep-comment: normal only with a second writer
                    context.Entry(record).State = EntityState.Detached;
                }
                catch (Exception ex) when (ex is not OperationCanceledException && claimed.Count > 0)
                {
                    // Rows already won are Processing in the database; returning Error would strand them until a restart. keep-comment: hand them to the processor
                    _logger.LogError(ex, "DomainEventRepository: ClaimDueAsync -> Stopped after claiming {claimed} of {due} due events.", claimed.Count, due.Count);
                    break;
                }
            }

            return RepositoryResult<DomainEventBatch>.Success(new DomainEventBatch(claimed, due.Count));
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRepository: ClaimDueAsync -> Something went wrong when claiming due events.");
            return RepositoryResult<DomainEventBatch>.Error();
        }
    }

    public async Task<RepositoryResult> MarkHandledAsync(int id, IReadOnlyList<string> completedHandlers, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var record = await context.DomainEvents.FirstOrDefaultAsync(e => e.Id == id && e.Status == DomainEventStatus.Processing, ctoken);
            if (record is null)
                return await context.DomainEvents.AnyAsync(e => e.Id == id, ctoken) ? RepositoryResult.Conflict() : RepositoryResult.NotFound();

            var now = DateTime.UtcNow;

            record.Status = DomainEventStatus.Handled;
            record.CompletedHandlers = JsonSerializer.Serialize(completedHandlers);
            record.LastError = null;
            record.SettledAt = now;
            record.LastUpdatedAt = now;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult.Conflict();
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRepository: MarkHandledAsync -> Something went wrong for event {id}.", id);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<DomainEventRecord>> MarkFailedAsync(
        int id, string error, IReadOnlyList<string> completedHandlers, bool permanent, int maxAttempts, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Only a Processing row may be marked: a rival that moved it while the handlers ran must not be overwritten. keep-comment: the token alone only covers read-to-write
            var record = await context.DomainEvents.FirstOrDefaultAsync(e => e.Id == id && e.Status == DomainEventStatus.Processing, ctoken);
            if (record is null)
            {
                return await context.DomainEvents.AnyAsync(e => e.Id == id, ctoken)
                    ? RepositoryResult<DomainEventRecord>.Conflict()
                    : RepositoryResult<DomainEventRecord>.NotFound();
            }

            var now = DateTime.UtcNow;

            record.Attempts += 1;
            record.LastError = error.Length > MaxErrorLength ? error[..MaxErrorLength] : error;
            record.CompletedHandlers = JsonSerializer.Serialize(completedHandlers);
            record.LastUpdatedAt = now;

            if (permanent || record.Attempts >= maxAttempts)
            {
                record.Status = DomainEventStatus.Failed;

                // Only when parking: a row going back to Pending has not settled. keep-comment: stamping it would start a retention clock on a live row
                record.SettledAt = now;
            }
            else
            {
                record.Status = DomainEventStatus.Pending;
                record.NextAttemptAt = now + BackoffFor(record.Attempts);
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<DomainEventRecord>.Success(record);
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult<DomainEventRecord>.Conflict();
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRepository: MarkFailedAsync -> Something went wrong for event {id}.", id);
            return RepositoryResult<DomainEventRecord>.Error();
        }
    }

    public async Task<RepositoryResult<int>> ResetInterruptedAsync(int maxAttempts, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var interrupted = await context.DomainEvents
                .Where(e => e.Status == DomainEventStatus.Processing)
                .ToListAsync(ctoken);

            foreach (var record in interrupted)
            {
                var now = DateTime.UtcNow;

                // An interruption counts as an attempt, so a payload that crashes the process parks after MaxAttempts instead of looping across restarts. keep-comment: Attempts was otherwise only counted by a failed mark
                record.Attempts += 1;
                record.LastUpdatedAt = now;

                if (record.Attempts >= maxAttempts)
                {
                    record.Status = DomainEventStatus.Failed;
                    record.LastError = $"Interrupted by a restart while processing, {record.Attempts} time(s).";
                    record.SettledAt = now;
                }
                else
                {
                    record.Status = DomainEventStatus.Pending;
                }
            }

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<int>.Success(interrupted.Count);
        }
        catch (DbUpdateConcurrencyException)
        {
            return RepositoryResult<int>.Conflict();
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRepository: ResetInterruptedAsync -> Something went wrong when resetting interrupted events.");
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<int>> PurgeSettledBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var deleted = await context.DomainEvents
                .Where(PurgeableSettled(cutoffUtc))
                .ExecuteDeleteAsync(ctoken);

            return RepositoryResult<int>.Success(deleted);
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DomainEventRepository: PurgeSettledBeforeAsync -> Something went wrong when purging settled events.");
            return RepositoryResult<int>.Error();
        }
    }

    // Attempt 1 -> 1 min, 2 -> 2, 3 -> 4, 4 -> 8, 5 -> 16. keep-comment: same ladder as the mail outbox
    private static TimeSpan BackoffFor(int attempts)
    {
        // The exponent is clamped, not the result: 2^34 minutes already overflows TimeSpan. keep-comment: boundary found by review
        var minutes = Math.Pow(2, Math.Clamp(attempts - 1, 0, 5));
        var backoff = TimeSpan.FromMinutes(minutes);

        return backoff > MaxBackoff ? MaxBackoff : backoff;
    }
}
