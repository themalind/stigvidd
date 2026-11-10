// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Duende.AccessTokenManagement;
using Keycloak.AuthServices.Common;
using Keycloak.AuthServices.Sdk;

namespace StigviddAPI.Extensions;

public static class KeycloakAdminClientExtensions
{
    private const string TokenClientName = "KeycloakAdminTokenClient";

    public static IServiceCollection AddStigviddKeycloakAdminClient(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetKeycloakOptions<KeycloakAdminClientOptions>(configSectionName: "KeycloakAdminClient")
            ?? throw new InvalidOperationException("KeycloakAdminClientOptions not found in configuration.");

        services.AddDistributedMemoryCache();
        services
            .AddClientCredentialsTokenManagement()
            .AddClient(TokenClientName, client =>
            {
                client.ClientId = ClientId.Parse(options.Resource);
                client.ClientSecret = ClientSecret.Parse(options.Credentials.Secret);
                client.TokenEndpoint = new Uri(options.KeycloakTokenEndpoint);
            });

        services
            .AddKeycloakAdminHttpClient(options)
            .AddClientCredentialsTokenHandler(ClientCredentialsClientName.Parse(TokenClientName));

        return services;
    }
}
