using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;

namespace StigviddAPI.Authorization;

/// <summary>
/// Keycloak puts realm roles in a JSON "realm_access" claim
/// (<c>{"roles":["admin",...]}</c>). This flattens them into standard Role
/// claims so <c>[Authorize(Roles = "...")]</c> / policies can use them.
/// </summary>
public class KeycloakRealmRolesTransformation : IClaimsTransformation
{
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        var realmAccess = principal.FindFirst("realm_access")?.Value;

        if (identity is null || string.IsNullOrWhiteSpace(realmAccess))
            return Task.FromResult(principal);

        try
        {
            using var doc = JsonDocument.Parse(realmAccess);
            if (doc.RootElement.TryGetProperty("roles", out var roles) && roles.ValueKind == JsonValueKind.Array)
            {
                foreach (var role in roles.EnumerateArray())
                {
                    var name = role.GetString();
                    if (!string.IsNullOrWhiteSpace(name) && !identity.HasClaim(ClaimTypes.Role, name))
                        identity.AddClaim(new Claim(ClaimTypes.Role, name));
                }
            }
        }
        catch (JsonException)
        {
            // Malformed claim — leave the principal unchanged.
        }

        return Task.FromResult(principal);
    }
}
