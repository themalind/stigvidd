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
    /// Validates the Authorization header and creates an authenticated user if the test token is present.
    /// </summary>
    /// <returns>
    /// An AuthenticateResult indicating success with a test user principal,
    /// or failure if the Authorization header is missing or invalid.
    /// </returns>
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Check if the Authorization header is present in the request
        if (!Request.Headers.ContainsKey("Authorization"))
        {
            return Task.FromResult(AuthenticateResult.Fail("Missing Authorization header"));
        }

        // Extract the Authorization header value
        var authHeader = Request.Headers["Authorization"].ToString();

        // Validate that the header contains the expected test bearer token
        if (authHeader != "Bearer test-token")
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid Authorization header"));
        }

        // Create a set of claims for the test user
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "Test User"),
            new Claim(ClaimTypes.NameIdentifier, "test-user-id")
        };

        // Build the authentication objects: identity, principal, and ticket
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");

        // Return successful authentication with the test user
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}