// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Account;

// Issues and settles the "prove you own this address" challenge that stands between
// registering and being able to log in.
public interface IEmailVerificationService
{
    /// <summary>
    /// Issues a fresh challenge for a user and queues the mail carrying it, retiring any
    /// outstanding one. <paramref name="requestBaseUrl"/> is used to build the link when
    /// <c>EmailVerification:BaseUrl</c> is not configured.
    /// </summary>
    Task<Result> IssueAndSendAsync(int userId, string email, string nickName, string requestBaseUrl, CancellationToken ctoken);

    /// <summary>Settles the challenge from a link token.</summary>
    Task<Result<EmailVerificationOutcome>> VerifyByTokenAsync(string rawToken, CancellationToken ctoken);

    /// <summary>Settles the challenge from an address plus the six-digit code.</summary>
    Task<Result<EmailVerificationOutcome>> VerifyByCodeAsync(string email, string code, CancellationToken ctoken);

    /// <summary>
    /// Issues and sends a new challenge for an address. Reports success whether or not the
    /// address exists, is already verified, or is inside its cooldown — the caller is
    /// unauthenticated, so it must not learn which addresses are registered.
    /// </summary>
    Task<Result> ResendAsync(string email, string requestBaseUrl, CancellationToken ctoken);
}
