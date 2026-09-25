// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Friend;

namespace Core.Interfaces.Services;

public interface IUserBlockService
{
    Task<Result> BlockUserAsync(string currentUserIdentifier, string targetIdentifier, CancellationToken ctoken);

    Task<Result> UnblockUserAsync(string currentUserIdentifier, string targetIdentifier, CancellationToken ctoken);

    Task<Result<IReadOnlyCollection<BlockedUserResponse>>> GetBlockedUsersAsync(string currentUserIdentifier, CancellationToken ctoken);

    /// <summary>The users this viewer blocked; empty when signed out or when the lookup fails.</summary>
    Task<int[]> GetHiddenUserIdsForReadAsync(string? viewerIdentifier, CancellationToken ctoken);
}
