// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Keycloak.AuthServices.Sdk.Admin;
using Keycloak.AuthServices.Sdk.Admin.Models;
using Keycloak.AuthServices.Sdk.Admin.Requests.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class KeycloakAdminRepository : IKeycloakAdminRepository
{
    private readonly IKeycloakUserClient _userClient;
    private readonly ILogger<KeycloakAdminRepository> _logger;
    private readonly string _realm;

    public KeycloakAdminRepository(
        IKeycloakUserClient userClient,
        IConfiguration configuration,
        ILogger<KeycloakAdminRepository> logger)
    {
        _userClient = userClient;
        _logger = logger;
        _realm = configuration["Keycloak:realm"]
            ?? throw new InvalidOperationException("Keycloak:realm configuration is missing.");
    }

    public async Task<string> CreateUserAsync(string email, string nickName, string password, CancellationToken ctoken)
    {
        var representation = new UserRepresentation
        {
            Username = email,
            Email = email,
            FirstName = nickName,
            // Disabled until the address is proven. This is the email-verification gate --
            // the app logs in directly against Keycloak, so nothing in this API could refuse
            // a sign-in. See ActivateVerifiedUserAsync, and
            // docs/notes/verification-gate-lives-in-keycloak-not-the-api.md.
            Enabled = false,
            EmailVerified = false,
            Credentials = new List<CredentialRepresentation>
            {
                new() { Type = "password", Value = password, Temporary = false },
            },
        };

        using var response = await _userClient.CreateUserWithResponseAsync(_realm, representation, ctoken);

        if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            throw new KeycloakUserConflictException($"A Keycloak user with email {email} already exists.");
        }

        response.EnsureSuccessStatusCode();

        // Keycloak returns the new user's id as the last segment of the Location header.
        var location = response.Headers.Location?.ToString();
        var subjectId = location?.TrimEnd('/').Split('/').LastOrDefault();

        if (string.IsNullOrEmpty(subjectId))
        {
            // Fall back to looking the user up by email when no Location header is present.
            var users = await _userClient.GetUsersAsync(
                _realm,
                new GetUsersRequestParameters { Email = email, Exact = true },
                ctoken);
            subjectId = users.FirstOrDefault()?.Id;
        }

        if (string.IsNullOrEmpty(subjectId))
        {
            throw new InvalidOperationException($"Keycloak user for {email} was created but its id could not be resolved.");
        }

        return subjectId;
    }

    public async Task ActivateVerifiedUserAsync(string subjectId, CancellationToken ctoken)
    {
        // A partial representation: Keycloak merges it, so the password and profile set at
        // creation are untouched. Sending it twice is harmless, which is what keeps a repeated
        // verification click idempotent.
        await _userClient.UpdateUserAsync(
            _realm,
            subjectId,
            new UserRepresentation { Enabled = true, EmailVerified = true },
            ctoken);
    }

    public async Task DeleteUserAsync(string subjectId, CancellationToken ctoken)
    {
        await _userClient.DeleteUserAsync(_realm, subjectId, ctoken);
    }

    public async Task<bool> SetPasswordAsync(string subjectId, string newPassword, CancellationToken ctoken)
    {
        // WithResponse rather than the throwing overload, for the same reason CreateUserAsync
        // uses it: one specific status is an expected answer and not a fault. Keycloak replies
        // 400 when the new password violates the realm's password policy.
        using var response = await _userClient.ResetPasswordWithResponseAsync(
            _realm,
            subjectId,
            new CredentialRepresentation { Type = "password", Value = newPassword, Temporary = false },
            ctoken);

        if (response.StatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            // The body carries a Keycloak message key (invalidPasswordMinLengthMessage and
            // friends), localised by the realm's own bundles. It is logged rather than shown:
            // a raw message key is not something to put in front of a user.
            var body = await response.Content.ReadAsStringAsync(ctoken);
            _logger.LogInformation("Keycloak refused a new password for {SubjectId}: {Body}", subjectId, body);
            return false;
        }

        response.EnsureSuccessStatusCode();

        return true;
    }
}
