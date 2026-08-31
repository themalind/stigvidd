// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Runtime.CompilerServices;

namespace IntegrationTests;

/// <summary>
/// Supplies the Keycloak configuration the test host needs to start, before any host starts.
/// </summary>
/// <remarks>
/// <para>
/// The integration tests boot the real <c>StigviddAPI.Program.Main</c>, so the host reads
/// StigviddAPI's own configuration sources. The Keycloak values used to sit in
/// <c>appsettings.json</c> and the suite silently inherited them; once they were (rightly)
/// taken out of git, <c>AddKeycloakAdminHttpClient</c>'s <c>ValidateOnStart</c> began throwing
/// during <c>Host.StartAsync</c> and all 337 tests died in their constructors, naming neither
/// the file nor the section.
/// </para>
/// <para>
/// This has to be environment variables set from a module initializer, not
/// <c>ConfigureAppConfiguration</c> on the factory. <c>WebApplicationFactory</c> reaches a
/// <c>Program.Main</c> through <c>DeferredHostBuilder</c>, whose configuration callbacks run
/// too late for the <c>builder.Configuration</c> reads inside <c>Program.Main</c> itself —
/// measured, the suite still fails 337/337 that way, which looks exactly like no fix at all.
/// </para>
/// <para>
/// Environment variables also rank ABOVE user secrets in
/// <c>WebApplication.CreateBuilder</c>'s provider order, and that is the point rather than a
/// side effect: the factory runs as <c>Development</c>, so a developer holding real Keycloak
/// values in StigviddAPI's user secrets had a green suite on the very tree that failed on
/// Jenkins. Overriding here makes every box agree with CI.
/// </para>
/// <para>
/// <c>.invalid</c> is reserved and unresolvable (RFC 2606). <c>IKeycloakAdminRepository</c> is
/// mocked in <c>StigViddWebApplicationFactory</c>, so a real call would be a bug; this makes it
/// fail loudly instead of reaching a live Keycloak.
/// </para>
/// <para>
/// See <c>docs/notes/integration-tests-inherit-api-config.md</c> for the measurements,
/// including the per-key mutation table and why a green local run proves nothing here.
/// </para>
/// </remarks>
internal static class KeycloakConfigPreload
{
    private const string AuthServerUrl = "https://keycloak.invalid/auth";

    [ModuleInitializer]
    internal static void Init()
    {
        // Double underscore per section level; the keys are kebab-case because that is how
        // Keycloak.AuthServices names them (see appsettings.json and docker-compose.yml).

        // THE load-bearing one. Removing it reproduces the Jenkins failure exactly:
        // 337 failed, "requires a valid absolute URI for 'AuthServerUrl'".
        Environment.SetEnvironmentVariable("KeycloakAdminClient__auth-server-url", AuthServerUrl);

        // The two below are measured NOT to be needed today, and are kept anyway because the
        // failure each prevents is the same cryptic 337-way one:
        //  - the JWT bearer authority. Inert while ConfigureTestServices replaces the default
        //    scheme with TestAuthHandler and JwtBearer never resolves its metadata.
        Environment.SetEnvironmentVariable("Keycloak__auth-server-url", AuthServerUrl);
        //  - parsed by Duende's AddClient callback, which is lazy and never runs while the
        //    admin repository is mocked. ClientSecret.Parse(null) is what waits behind it.
        Environment.SetEnvironmentVariable(
            "KeycloakAdminClient__credentials__secret", "integration-tests-not-a-real-secret");
    }
}
