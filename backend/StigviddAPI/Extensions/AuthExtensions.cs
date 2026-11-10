// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Keycloak.AuthServices.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace StigviddAPI.Extensions;

public static class AuthExtensions
{
    public static IServiceCollection AddStigviddAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddKeycloakWebApiAuthentication(configuration);
        services.AddJwtBearerFailureLogging();

        // Flattens Keycloak realm roles into Role claims.
        services.AddSingleton<IClaimsTransformation, KeycloakRealmRolesTransformation>();
        var adminRole = configuration["Authorization:AdminRole"] ?? "stigvidd-admin";

        services.AddAuthorization(options =>
        {
            // An UNCHECKED STRING: a mismatch with [Authorize(Policy = ...)] is a 500 at request time.
            // EndpointAuthorizationTests pins it (docs/notes/authorize-policy-names-are-unchecked-strings.md).
            options.AddPolicy("AdminOnly", policy => policy.RequireRole(adminRole));

            // An endpoint without authorization metadata needs a signed-in caller; public ones use [AllowAnonymous].
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });
        services.AddSingleton<IAuthorizationMiddlewareResultHandler, LoggingAuthorizationResultHandler>();

        return services;
    }
}
