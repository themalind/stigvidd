// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IMailOutboxRepository
{
    Task<RepositoryResult<OutboxEmail>> AddAsync(OutboxEmail email, CancellationToken ctoken);

    /// <summary>
    /// Takes ownership of a row by moving it Pending -> Sending, or reports Conflict when it
    /// was not Pending.
    /// </summary>
    /// <remarks>
    /// This is what makes a duplicate queue signal harmless, so it is the one place the
    /// status transition may happen. Assumes a single API instance: it is a read-then-update,
    /// not SELECT ... FOR UPDATE SKIP LOCKED.
    /// </remarks>
    Task<RepositoryResult<OutboxEmail>> ClaimAsync(int id, CancellationToken ctoken);

    /// <summary>
    /// Puts a claimed row back to Pending without counting an attempt, for when it turns out
    /// not to be due yet. Distinct from MarkFailedAsync because nothing was tried: counting
    /// an attempt here would burn a retry and rewrite the backoff the row is still serving.
    /// </summary>
    Task<RepositoryResult> ReleaseAsync(int id, CancellationToken ctoken);

    Task<RepositoryResult> MarkSentAsync(int id, CancellationToken ctoken);

    /// <summary>
    /// Records a failed attempt. Returns the updated row so the caller can see whether it is
    /// Pending again (and when it is next due) or has been parked as Failed.
    /// </summary>
    Task<RepositoryResult<OutboxEmail>> MarkFailedAsync(
        int id, string error, bool permanent, int maxAttempts, CancellationToken ctoken);

    /// <summary>
    /// Moves rows left in Sending by a restart back to Pending. They have no worker holding
    /// them — the queue that referenced them died with the process.
    /// </summary>
    Task<RepositoryResult<int>> ResetInterruptedAsync(CancellationToken ctoken);

    /// <summary>
    /// Every Pending id, oldest first, including rows whose backoff has not yet expired: the
    /// dispatcher re-checks NextAttemptAt and reschedules those rather than sending them.
    /// </summary>
    Task<RepositoryResult<IReadOnlyCollection<int>>> GetPendingIdsAsync(CancellationToken ctoken);
}
