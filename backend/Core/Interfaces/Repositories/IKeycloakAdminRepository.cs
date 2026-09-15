// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

/// <summary>
/// Wraps the Keycloak Admin API for the identity-provider operations StigVidd needs:
/// provisioning users at registration, deleting them, and setting passwords.
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
    /// Sets the user's password. Returns false when Keycloak refuses it for violating the
    /// realm's password policy, true when it is accepted.
    /// </summary>
    /// <remarks>
    /// The realm password policy is the only policy there is -- it lives in Keycloak's own
    /// database and not in this repository, so it cannot be mirrored in a validator here.
    /// That is why a refusal is an ordinary return value rather than an exception: it is an
    /// expected answer to a user typing a weak password, not a fault.
    /// </remarks>
    Task<bool> SetPasswordAsync(string subjectId, string newPassword, CancellationToken ctoken);
}

/// <summary>Thrown when Keycloak rejects user creation because the user already exists.</summary>
public class KeycloakUserConflictException : Exception
{
    public KeycloakUserConflictException(string message) : base(message) { }
}
