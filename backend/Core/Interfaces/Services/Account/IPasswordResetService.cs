// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Account;

// Issues and settles the "set a new password" challenge behind the forgot-password flow.
public interface IPasswordResetService
{
    /// <summary>
    /// Issues a fresh reset link for an address and queues the mail carrying it, retiring any
    /// outstanding one. Reports success whether or not the address exists or is inside its
    /// cooldown — the caller is unauthenticated, so it must not learn which addresses are
    /// registered. <paramref name="requestBaseUrl"/> builds the link when
    /// <c>PasswordReset:BaseUrl</c> is not configured.
    /// </summary>
    Task<Result> IssueAndSendAsync(string email, string requestBaseUrl, CancellationToken ctoken);

    /// <summary>
    /// Checks a link token without spending it, so the form can be rendered. Consuming here
    /// would let a mail scanner following the link burn it before the human sees the page.
    /// </summary>
    Task<Result<PasswordResetOutcome>> ValidateAsync(string rawToken, CancellationToken ctoken);

    /// <summary>
    /// Sets the new password and spends the link, in that order — a token consumed against a
    /// Keycloak call that then failed would leave the user with no way forward.
    /// </summary>
    Task<Result<PasswordResetOutcome>> ResetAsync(string rawToken, string newPassword, CancellationToken ctoken);
}
