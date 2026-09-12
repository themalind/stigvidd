// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

// Storage for the registration email-verification challenges. Everything here works in terms
// of hashes: the raw token and code never reach this layer.
public interface IEmailVerificationTokenRepository
{
    /// <summary>Finds the user an address belongs to. Matched case-insensitively.</summary>
    Task<RepositoryResult<User>> GetUserByEmailAsync(string email, CancellationToken ctoken);

    /// <summary>
    /// Consumes every outstanding row for a user and adds this one, in a single save. Issuing a
    /// new challenge must retire the old one, or a resend would leave two live codes.
    /// </summary>
    Task<RepositoryResult> ReplaceOutstandingAsync(EmailVerificationToken token, CancellationToken ctoken);

    /// <summary>Finds a row by its token hash, with the owning user loaded. Consumed rows are returned too.</summary>
    Task<RepositoryResult<EmailVerificationToken>> GetByTokenHashAsync(string tokenHash, CancellationToken ctoken);

    /// <summary>The user's most recently issued row, consumed or not — what the resend cooldown is measured from.</summary>
    Task<RepositoryResult<EmailVerificationToken>> GetLatestForUserAsync(int userId, CancellationToken ctoken);

    /// <summary>
    /// Marks the row consumed and stamps the owning user's <c>EmailVerifiedAt</c>, in one save.
    /// The two must not drift: a consumed token whose user still reads unverified is unrecoverable.
    /// </summary>
    Task<RepositoryResult> ConsumeAsync(int tokenId, DateTime verifiedAt, CancellationToken ctoken);

    /// <summary>Counts one wrong code against the row and returns the new total.</summary>
    Task<RepositoryResult<int>> IncrementAttemptsAsync(int tokenId, CancellationToken ctoken);
}
