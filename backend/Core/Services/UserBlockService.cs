// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using WebDataContracts.ResponseModels.Friend;

namespace Core.Services;

public class UserBlockService : IUserBlockService
{
    private readonly IUserBlockRepository _userBlockRepository;
    private readonly IUserRepository _userRepository;

    public UserBlockService(
        IUserBlockRepository userBlockRepository,
        IUserRepository userRepository)
    {
        _userBlockRepository = userBlockRepository;
        _userRepository = userRepository;
    }

    public async Task<Result> BlockUserAsync(string currentUserIdentifier, string targetIdentifier, CancellationToken ctoken)
    {
        var idsResult = await ResolveBothAsync(currentUserIdentifier, targetIdentifier, ctoken);

        if (!idsResult.Success)
            return Result.Fail(idsResult.Message ?? new Message(500, "An error occurred while blocking the user."));

        var (currentUserId, targetUserId) = idsResult.Value;

        // Only the row: removing the friendship or shares would tell the blocked person.
        var blockResult = await _userBlockRepository.BlockAsync(currentUserId, targetUserId, ctoken);

        if (blockResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while blocking the user."));

        return Result.Ok();
    }

    public async Task<Result> UnblockUserAsync(string currentUserIdentifier, string targetIdentifier, CancellationToken ctoken)
    {
        var idsResult = await ResolveBothAsync(currentUserIdentifier, targetIdentifier, ctoken);

        if (!idsResult.Success)
            return Result.Fail(idsResult.Message ?? new Message(500, "An error occurred while unblocking the user."));

        var (currentUserId, targetUserId) = idsResult.Value;

        var result = await _userBlockRepository.UnblockAsync(currentUserId, targetUserId, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "This user is not blocked."));

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while unblocking the user."));

        return Result.Ok();
    }

    public async Task<Result<IReadOnlyCollection<BlockedUserResponse>>> GetBlockedUsersAsync(string currentUserIdentifier, CancellationToken ctoken)
    {
        var currentUserIdResult = await ResolveUserIdAsync(currentUserIdentifier, "Current user not found.", ctoken);

        if (!currentUserIdResult.Success)
            return Result.Fail<IReadOnlyCollection<BlockedUserResponse>>(currentUserIdResult.Message ?? new Message(500, "An error occurred while retrieving the current user."));

        var blockedResult = await _userBlockRepository.GetBlockedByUserAsync(
            currentUserIdResult.Value,
            (block, user) => BlockedUserResponse.Create(user.Identifier, user.NickName, block.CreatedAt),
            ctoken);

        if (!blockedResult.IsSuccess)
            return Result.Fail<IReadOnlyCollection<BlockedUserResponse>>(new Message(500, "An error occurred while retrieving the blocked users."));

        return Result.Ok<IReadOnlyCollection<BlockedUserResponse>>(blockedResult.Value ?? []);
    }

    public async Task<int[]> GetHiddenUserIdsForReadAsync(string? viewerIdentifier, CancellationToken ctoken)
    {
        if (string.IsNullOrWhiteSpace(viewerIdentifier))
            return [];

        var viewerIdResult = await _userRepository.GetUserIdByIdentifierAsync(viewerIdentifier, ctoken);

        if (!viewerIdResult.IsSuccess)
            return [];

        var hiddenResult = await _userBlockRepository.GetHiddenUserIdsAsync(viewerIdResult.Value, ctoken);

        return hiddenResult.IsSuccess ? hiddenResult.Value ?? [] : [];
    }

    private async Task<Result<(int CurrentUserId, int TargetUserId)>> ResolveBothAsync(
        string currentUserIdentifier, string targetIdentifier, CancellationToken ctoken)
    {
        var currentUserIdResult = await ResolveUserIdAsync(currentUserIdentifier, "Current user not found.", ctoken);

        if (!currentUserIdResult.Success)
            return Result.Fail<(int, int)>(currentUserIdResult.Message ?? new Message(500, "An error occurred while retrieving the current user."));

        var targetIdResult = await ResolveUserIdAsync(targetIdentifier, "User not found.", ctoken);

        if (!targetIdResult.Success)
            return Result.Fail<(int, int)>(targetIdResult.Message ?? new Message(500, "An error occurred while retrieving the user."));

        if (currentUserIdResult.Value == targetIdResult.Value)
            return Result.Fail<(int, int)>(new Message(400, "You cannot block yourself."));

        return Result.Ok((currentUserIdResult.Value, targetIdResult.Value));
    }

    private async Task<Result<int>> ResolveUserIdAsync(string identifier, string notFoundMessage, CancellationToken ctoken)
    {
        var result = await _userRepository.GetUserIdByIdentifierAsync(identifier, ctoken);

        if (result.IsSuccess)
            return Result.Ok(result.Value);

        return result.Status == RepositoryResultStatus.NotFound
            ? Result.Fail<int>(new Message(404, notFoundMessage))
            : Result.Fail<int>(new Message(500, "An error occurred while retrieving the user."));
    }
}
