// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace IntegrationTests;

/// <summary>
/// Custom authentication handler for integration tests.
/// Provides a simplified authentication mechanism that validates a test bearer token
/// and creates a test user principal for authenticated requests.
/// </summary>
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    /// <summary>
    /// Comma-separated realm roles to put on the test principal. Opt-in, so a request
    /// without it authenticates with no roles and fails role-based policies — which is
    /// what lets tests assert 403 on the admin endpoints.
    /// In production the equivalent claims come from <c>KeycloakRealmRolesTransformation</c>.
    /// </summary>
    public const string RolesHeader = "X-Test-Roles";

    /// <summary>The role behind the "AdminOnly" policy. Mirrors the Program.cs fallback.</summary>
    public const string AdminRole = "stigvidd-admin";

    public TestAuthHandler(
      IOptionsMonitor<AuthenticationSchemeOptions> options,
      ILoggerFactory logger,
      UrlEncoder encoder)
      : base(options, logger, encoder)
    {
    }

    /// <summary>
    /// Handles authentication for incoming requests.
    /// Extracts the user identifier from the token (format: "Bearer {subjectId}")
    /// and creates a test user principal with that identifier.
    /// </summary>
    /// <returns>
    /// An AuthenticateResult indicating success with a test user principal,
    /// or failure if the Authorization header is missing or invalid.
    /// </returns>
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.ContainsKey("Authorization"))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing Authorization header"));
        }

        var authHeader = Request.Headers["Authorization"].ToString();

        if (!authHeader.StartsWith("Bearer "))
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid Authorization header format"));
        }

        // Extract the firebase UID from the token (everything after "Bearer ")
        var subjectId = authHeader["Bearer ".Length..];

        if (string.IsNullOrWhiteSpace(subjectId))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing user identifier in token"));
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, "Test User"),
            new(ClaimTypes.NameIdentifier, subjectId)
        };

        claims.AddRange(Request.Headers[RolesHeader]
            .SelectMany(value => (value ?? string.Empty).Split(','))
            .Select(role => role.Trim())
            .Where(role => role.Length > 0)
            .Select(role => new Claim(ClaimTypes.Role, role)));

        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}