// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

// DueCount is what the query found, Claimed what this caller won; the two differ when another writer moved a row first. keep-comment: the drain loop keys on DueCount
public record DomainEventBatch(IReadOnlyList<DomainEventRecord> Claimed, int DueCount);

public interface IDomainEventRepository
{
    Task<RepositoryResult<DomainEventRecord>> AddAsync(DomainEventRecord record, CancellationToken ctoken);
    Task<RepositoryResult<DomainEventBatch>> ClaimDueAsync(int batchSize, CancellationToken ctoken);
    Task<RepositoryResult> MarkHandledAsync(int id, IReadOnlyList<string> completedHandlers, CancellationToken ctoken);
    Task<RepositoryResult<DomainEventRecord>> MarkFailedAsync(int id, string error, IReadOnlyList<string> completedHandlers, bool permanent, int maxAttempts, CancellationToken ctoken);
    Task<RepositoryResult<int>> ResetInterruptedAsync(int maxAttempts, CancellationToken ctoken);
    Task<RepositoryResult<int>> PurgeSettledBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken);
}
