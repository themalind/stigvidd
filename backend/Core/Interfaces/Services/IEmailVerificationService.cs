// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

/// <summary>What a verification attempt actually resolved to. All of these are ordinary
/// outcomes, not failures — a failed <see cref="Result{T}"/> means the attempt could not be
/// evaluated at all.</summary>
public enum EmailVerificationOutcome
{
    /// <summary>The challenge was met just now, and the Keycloak user has been enabled.</summary>
    Verified,

    /// <summary>
    /// This address was already verified. Treated as success on purpose: mail scanners and
    /// corporate link-prefetchers follow the link before the human does, so the real click
    /// must not land on an error.
    /// </summary>
    AlreadyVerified,

    /// <summary>There was a matching challenge, but it is past its lifetime.</summary>
    Expired,

    /// <summary>No such token, or the wrong code for this address.</summary>
    Invalid,

    /// <summary>Too many wrong codes against this challenge; it is dead and a resend is needed.</summary>
    TooManyAttempts,
}

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
