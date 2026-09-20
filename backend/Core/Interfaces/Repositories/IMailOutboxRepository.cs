// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories;

/// <summary>
/// One row of the outbox as the admin list sees it.
/// </summary>
/// <remarks>
/// Carries no BodyHtml/BodyText on purpose. A page of rendered mail bodies is megabytes on the
/// wire and megabytes in the change tracker, and the only way to guarantee they are never read
/// is to project without them.
/// </remarks>
public record OutboxEmailSummary(
    string Identifier,
    string ToAddress,
    string? ToName,
    string Subject,
    string? TemplateKey,
    OutboxEmailStatus Status,
    int Attempts,
    DateTime NextAttemptAt,
    DateTime? SentAt,
    string? LastError,
    DateTime? SettledAt,
    DateTime? RedactedAt,
    DateTime CreatedAt,
    DateTime LastUpdatedAt);

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

    // ---- The admin surface. Everything above is the dispatcher's and keys on Id; everything
    // ---- below is an operator's and keys on Identifier, like every other admin surface.

    /// <summary>
    /// A page of the outbox, newest first, without the mail bodies.
    /// </summary>
    /// <remarks>
    /// Newest-first on purpose, unlike the moderation queue: a queue is worked oldest-first, but
    /// an outbox is a log an operator reads backwards from the incident they are chasing.
    /// </remarks>
    Task<RepositoryResult<PagedResult<OutboxEmailSummary>>> GetPagedAsync(
        OutboxEmailStatus? status,
        string? templateKey,
        string? recipient,
        int page,
        int pageSize,
        CancellationToken ctoken);

    Task<RepositoryResult<OutboxEmail>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyDictionary<OutboxEmailStatus, int>>> GetCountsByStatusAsync(
        CancellationToken ctoken);

    /// <summary>
    /// Failed or Cancelled -> Pending, due now, with the attempt ladder reset. Conflict on any
    /// other status. Returns the row so the caller can signal the dispatcher with its Id.
    /// </summary>
    /// <remarks>
    /// Never touches a Sending row. That row is claimed by the dispatcher right now, and moving
    /// it back to Pending would make it claimable while a worker still holds it — the same mail
    /// sent twice, which is exactly what claiming in the database exists to prevent.
    /// </remarks>
    Task<RepositoryResult<OutboxEmail>> RequeueAsync(string identifier, CancellationToken ctoken);

    /// <summary>
    /// Pending -> Cancelled. Conflict on any other status.
    /// </summary>
    /// <remarks>
    /// Refuses a Sending row because MarkSentAsync has no status guard: the dispatcher would
    /// overwrite the cancellation moments later, and the operator would have been told the mail
    /// was stopped when it was already on its way.
    /// </remarks>
    Task<RepositoryResult<OutboxEmail>> CancelAsync(string identifier, CancellationToken ctoken);

    /// <summary>
    /// Deletes Sent rows whose SentAt is strictly older than the cutoff. Returns the row count.
    /// </summary>
    Task<RepositoryResult<int>> PurgeSentBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken);

    // ---- Retention. Driven by MailOutboxRetentionService, on a timer rather than by an
    // operator, because storage limitation is not something anyone should have to remember.

    /// <summary>
    /// Deletes Failed and Cancelled rows that settled strictly before the cutoff, dated by
    /// SettledAt. Returns the row count.
    /// </summary>
    Task<RepositoryResult<int>> PurgeSettledBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken);

    /// <summary>
    /// Clears the rendered bodies of Failed and Cancelled rows that settled before the cutoff
    /// and have not been cleared already, stamping RedactedAt. Returns the row count.
    /// </summary>
    /// <remarks>
    /// Sent rows are not here: MarkSentAsync clears those as it marks them, since they can
    /// never be retried. These can, which is the whole reason their bodies get a window at all
    /// -- and why RequeueAsync refuses once the window has closed.
    /// </remarks>
    Task<RepositoryResult<int>> RedactBodiesBeforeAsync(DateTime cutoffUtc, CancellationToken ctoken);

    /// <summary>
    /// Erases every row for a recipient, for Art. 17 on account deletion. Returns the row count.
    /// </summary>
    /// <remarks>
    /// Rows still queued are moved to Cancelled first, so the dispatcher cannot claim one
    /// between the read and the delete. A row already Sending is left alone: nothing can recall
    /// a message on the wire, and the sweep collects it once it settles. Matching is on the
    /// address, because the outbox has no foreign key to Users -- so mail queued to an address
    /// the account no longer uses is not reached by this.
    /// </remarks>
    Task<RepositoryResult<int>> EraseByRecipientAsync(string emailAddress, CancellationToken ctoken);
}
