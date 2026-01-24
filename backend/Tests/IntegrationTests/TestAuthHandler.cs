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
    public TestAuthHandler(
      IOptionsMonitor<AuthenticationSchemeOptions> options,
      ILoggerFactory logger,
      UrlEncoder encoder)
      : base(options, logger, encoder)
    {
    }

    /// <summary>
    /// Handles authentication for incoming requests.
    /// Extracts the user identifier from the token (format: "Bearer {firebaseUid}")
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
        var firebaseUid = authHeader["Bearer ".Length..];

        if (string.IsNullOrWhiteSpace(firebaseUid))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing user identifier in token"));
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim(ClaimTypes.NameIdentifier, firebaseUid)
        };

        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}