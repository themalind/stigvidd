// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

public interface IAccountDeletionRepository
{
    // keep-comment: the caller deletes FileUrls and enqueues Pushes, and only after this has committed.
    Task<RepositoryResult<DeletedAccount>> DeleteAccountAsync(string identifier, CancellationToken ctoken);
}
