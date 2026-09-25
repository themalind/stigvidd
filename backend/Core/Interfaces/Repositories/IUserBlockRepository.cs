// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IUserBlockRepository
{
    /// <summary>Records that one user blocks another. Blocking twice is a success, not a conflict.</summary>
    Task<RepositoryResult> BlockAsync(int blockerUserId, int blockedUserId, CancellationToken ctoken);

    /// <summary>Removes the block. Returns NotFound when there was none.</summary>
    Task<RepositoryResult> UnblockAsync(int blockerUserId, int blockedUserId, CancellationToken ctoken);

    /// <summary>True when the first user has blocked the second. Directional, never the reverse.</summary>
    Task<RepositoryResult<bool>> HasBlockedAsync(int blockerUserId, int blockedUserId, CancellationToken ctoken);

    /// <summary>The ids to leave out of this user's reads: the people they blocked, and nobody else.</summary>
    Task<RepositoryResult<int[]>> GetHiddenUserIdsAsync(int userId, CancellationToken ctoken);

    /// <summary>The users this one has blocked, newest first, projected by the caller.</summary>
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetBlockedByUserAsync<T>(
        int userId, Expression<Func<UserBlock, User, T>> selector, CancellationToken ctoken);
}
