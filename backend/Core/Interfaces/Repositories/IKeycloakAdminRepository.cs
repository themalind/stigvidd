// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

/// <summary>
/// Wraps the Keycloak Admin API for the identity-provider operations StigVidd needs:
/// provisioning users at registration, deleting them, and triggering password resets.
/// Replaces the previous Firebase Admin integration.
/// </summary>
public interface IKeycloakAdminRepository
{
    /// <summary>
    /// Creates a DISABLED Keycloak user with the given password and returns its subject id (the JWT `sub`).
    /// Throws <see cref="KeycloakUserConflictException"/> if a user with the same email already exists.
    /// </summary>
    /// <remarks>
    /// Disabled is deliberate and is the whole email-verification gate: the app performs the
    /// Direct Access Grant straight against Keycloak's token endpoint, so this API is never in
    /// the login path and cannot refuse a sign-in. Keycloak rejecting a disabled user is the
    /// only enforcement there is. <see cref="ActivateVerifiedUserAsync"/> lifts it.
    /// </remarks>
    Task<string> CreateUserAsync(string email, string nickName, string password, CancellationToken ctoken);

    /// <summary>
    /// Enables the user and marks their email verified, letting them log in for the first time.
    /// Idempotent: activating an already-active user is a no-op, which is what lets a second
    /// click on a verification link succeed rather than error.
    /// </summary>
    Task ActivateVerifiedUserAsync(string subjectId, CancellationToken ctoken);

    /// <summary>Deletes the Keycloak user with the given subject id. No-op if it no longer exists.</summary>
    Task DeleteUserAsync(string subjectId, CancellationToken ctoken);

    /// <summary>
    /// Sends a Keycloak "update password" action email to the user with the given email.
    /// Silently does nothing if no such user exists (so callers don't leak which emails are registered).
    /// </summary>
    Task SendPasswordResetEmailAsync(string email, CancellationToken ctoken);
}

/// <summary>Thrown when Keycloak rejects user creation because the user already exists.</summary>
public class KeycloakUserConflictException : Exception
{
    public KeycloakUserConflictException(string message) : base(message) { }
}
