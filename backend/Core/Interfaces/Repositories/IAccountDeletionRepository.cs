// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;

namespace Core.Interfaces.Repositories;

public sealed record DeletedAccount(int UserId, IReadOnlyCollection<string> FileUrls, IReadOnlyCollection<PushMessage> Pushes);

public interface IAccountDeletionRepository
{
    // keep-comment: the caller deletes FileUrls and enqueues Pushes, and only after this has committed.
    Task<RepositoryResult<DeletedAccount>> DeleteAccountAsync(string identifier, CancellationToken ctoken);
}
