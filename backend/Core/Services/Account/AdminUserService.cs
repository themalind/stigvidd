// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services.Push;
using Microsoft.Extensions.Logging;

namespace Core.Services.Account;

public class AdminUserService : IAdminUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IPushQueue _pushQueue;
    private readonly ILogger<AdminUserService> _logger;

    public AdminUserService(IUserRepository userRepository, IPushQueue pushQueue, ILogger<AdminUserService> logger)
    {
        _userRepository = userRepository;
        _pushQueue = pushQueue;
        _logger = logger;
    }

    public async Task<Result> BanAsync(string identifier, string bannedBy, string? reason, CancellationToken ctoken)
    {
        var banned = await _userRepository.BanUserAsync(identifier, bannedBy, reason, ctoken);

        if (banned.IsSuccess)
        {
            foreach (var push in banned.Value.SelectMany(EventPushes.ForHandOver))
                _pushQueue.Enqueue(push);
        }

        return Report(banned.Status, identifier, "banned", bannedBy, "The user is already banned.");
    }

    public async Task<Result> UnbanAsync(string identifier, string unbannedBy, CancellationToken ctoken)
    {
        return Report((await _userRepository.UnbanUserAsync(identifier, unbannedBy, ctoken)).Status, identifier, "unbanned", unbannedBy, "The user is not banned.");
    }

    private Result Report(RepositoryResultStatus status, string identifier, string action, string moderator, string conflictMessage)
    {
        if (status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "User not found."));

        if (status == RepositoryResultStatus.Conflict)
            return Result.Fail(new Message(409, conflictMessage));

        if (status != RepositoryResultStatus.Success)
            return Result.Fail(new Message(500, $"An error occurred while the user was being {action}."));

        _logger.LogInformation("AdminUserService: user {identifier} was {action} by {moderator}.", identifier, action, moderator);

        return Result.Ok();
    }
}
