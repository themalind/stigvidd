namespace Core.Interfaces.Repositories;

/// <summary>
/// Wraps the Keycloak Admin API for the identity-provider operations StigVidd needs:
/// provisioning users at registration, deleting them, and triggering password resets.
/// Replaces the previous Firebase Admin integration.
/// </summary>
public interface IKeycloakAdminRepository
{
    /// <summary>
    /// Creates an enabled Keycloak user with the given password and returns its subject id (the JWT `sub`).
    /// Throws <see cref="KeycloakUserConflictException"/> if a user with the same email already exists.
    /// </summary>
    Task<string> CreateUserAsync(string email, string nickName, string password, CancellationToken ctoken);

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
