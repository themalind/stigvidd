// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.Admin;

/// <summary>
/// Guards the "AdminOnly" policy on every controller under api/v1/admin. Authentication
/// alone must not be enough: before these endpoints moved into Controllers/Admin they were
/// protected by a bare [Authorize], so any signed-in mobile user could reach them.
/// </summary>
public class AdminAuthorizationIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen — holds no admin role
    private const string Facility1Identifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";

    public AdminAuthorizationIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    /// <summary>
    /// One real route per admin controller. Authorization runs before the action, so these
    /// never reach a service — a destructive verb here deletes nothing.
    /// </summary>
    public static TheoryData<string, string> AdminEndpoints => new()
    {
        { "GET", "/api/v1/admin/export" },                                       // AdminController
        { "GET", "/api/v1/admin/media" },                                        // AdminMediaController
        { "DELETE", "/api/v1/admin/trails/images/any-image-identifier" },        // AdminTrailsController
        { "DELETE", $"/api/v1/admin/facilities/{Facility1Identifier}" },         // AdminFacilitiesController
        { "GET", "/api/v1/admin/mail-outbox/counts" },                           // AdminMailOutboxController
    };

    /// <summary>Authenticated as a real user who simply lacks the admin realm role.</summary>
    private HttpClient CreateNonAdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        return client;
    }

    [Theory]
    [MemberData(nameof(AdminEndpoints))]
    public async Task AdminEndpoints_WhenAuthenticatedWithoutAdminRole_ShouldReturnForbidden(string method, string route)
    {
        // Arrange
        var client = CreateNonAdminClient();

        // Act
        var response = await client.SendAsync(
            new HttpRequestMessage(new HttpMethod(method), route), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Theory]
    [MemberData(nameof(AdminEndpoints))]
    public async Task AdminEndpoints_WithoutAuthentication_ShouldReturnUnauthorized(string method, string route)
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.SendAsync(
            new HttpRequestMessage(new HttpMethod(method), route), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AdminEndpoint_WithAdminRole_ShouldNotBeForbidden()
    {
        // Arrange — the same request the theory rejects, only with the role added, so a
        // failure above can be pinned on the policy rather than on unrelated breakage.
        var client = CreateNonAdminClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);

        // Act
        var response = await client.GetAsync("/api/v1/admin/media", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
