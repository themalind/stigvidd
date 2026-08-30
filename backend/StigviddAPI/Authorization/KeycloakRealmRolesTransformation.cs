// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;

namespace StigviddAPI.Authorization;

/// <summary>
/// Keycloak puts realm roles in a JSON "realm_access" claim
/// (<c>{"roles":["admin",...]}</c>). This flattens them into role claims so
/// <c>[Authorize(Roles = "...")]</c> / policies can use them.
/// </summary>
public class KeycloakRealmRolesTransformation : IClaimsTransformation
{
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        var realmAccess = principal.FindFirst("realm_access")?.Value;

        if (identity is null || string.IsNullOrWhiteSpace(realmAccess))
            return Task.FromResult(principal);

        // IsInRole reads the identity's own RoleClaimType, which the Keycloak handler sets
        // to "role" — not ClaimTypes.Role. Writing the claim under any other type leaves
        // RequireRole finding nothing.
        var roleClaimType = string.IsNullOrEmpty(identity.RoleClaimType)
            ? ClaimTypes.Role
            : identity.RoleClaimType;

        try
        {
            using var doc = JsonDocument.Parse(realmAccess);
            if (doc.RootElement.TryGetProperty("roles", out var roles) && roles.ValueKind == JsonValueKind.Array)
            {
                foreach (var role in roles.EnumerateArray())
                {
                    var name = role.GetString();
                    if (!string.IsNullOrWhiteSpace(name) && !identity.HasClaim(roleClaimType, name))
                        identity.AddClaim(new Claim(roleClaimType, name));
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
