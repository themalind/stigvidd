// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Core.Services;

public class AdminUserService : IAdminUserService
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<AdminUserService> _logger;

    public AdminUserService(IUserRepository userRepository, ILogger<AdminUserService> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task<Result> BanAsync(string identifier, string bannedBy, string? reason, CancellationToken ctoken) =>
        Report(await _userRepository.BanUserAsync(identifier, bannedBy, reason, ctoken), identifier, "banned", bannedBy, "The user is already banned.");

    public async Task<Result> UnbanAsync(string identifier, string unbannedBy, CancellationToken ctoken) =>
        Report(await _userRepository.UnbanUserAsync(identifier, unbannedBy, ctoken), identifier, "unbanned", unbannedBy, "The user is not banned.");

    private Result Report(RepositoryResult result, string identifier, string action, string moderator, string conflictMessage)
    {
        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "User not found."));

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(new Message(409, conflictMessage));

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, $"An error occurred while the user was being {action}."));

        _logger.LogInformation("AdminUserService: user {identifier} was {action} by {moderator}.", identifier, action, moderator);

        return Result.Ok();
    }
}
