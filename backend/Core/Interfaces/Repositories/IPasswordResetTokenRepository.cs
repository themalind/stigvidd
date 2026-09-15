// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

// Storage for the password-reset challenges. Everything here works in terms of the hash: the
// raw token never reaches this layer.
public interface IPasswordResetTokenRepository
{
    /// <summary>Finds the user an address belongs to. Matched case-insensitively.</summary>
    Task<RepositoryResult<User>> GetUserByEmailAsync(string email, CancellationToken ctoken);

    /// <summary>
    /// Consumes every outstanding row for a user and adds this one, in a single save. Issuing a
    /// new challenge must retire the old one, or a second request would leave two live links.
    /// </summary>
    Task<RepositoryResult> ReplaceOutstandingAsync(PasswordResetToken token, CancellationToken ctoken);

    /// <summary>Finds a row by its token hash, with the owning user loaded. Consumed rows are returned too.</summary>
    Task<RepositoryResult<PasswordResetToken>> GetByTokenHashAsync(string tokenHash, CancellationToken ctoken);

    /// <summary>The user's most recently issued row, consumed or not — what the cooldown is measured from.</summary>
    Task<RepositoryResult<PasswordResetToken>> GetLatestForUserAsync(int userId, CancellationToken ctoken);

    /// <summary>
    /// Marks the row consumed. Called only after Keycloak has accepted the new password, so a
    /// failed password change leaves the link usable rather than stranding the user.
    /// </summary>
    Task<RepositoryResult> ConsumeAsync(int tokenId, DateTime consumedAt, CancellationToken ctoken);
}
