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
            Enabled = true,
            EmailVerified = true,
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

    public async Task DeleteUserAsync(string subjectId, CancellationToken ctoken)
    {
        await _userClient.DeleteUserAsync(_realm, subjectId, ctoken);
    }

    public async Task SendPasswordResetEmailAsync(string email, CancellationToken ctoken)
    {
        var users = await _userClient.GetUsersAsync(
            _realm,
            new GetUsersRequestParameters { Email = email, Exact = true },
            ctoken);

        var subjectId = users.FirstOrDefault()?.Id;
        if (string.IsNullOrEmpty(subjectId))
        {
            // Don't reveal whether the email is registered.
            _logger.LogInformation("Password reset requested for unknown email; ignoring.");
            return;
        }

        await _userClient.ExecuteActionsEmailAsync(
            _realm,
            subjectId,
            new ExecuteActionsEmailRequest { Actions = new List<string> { "UPDATE_PASSWORD" } },
            ctoken);
    }
}
