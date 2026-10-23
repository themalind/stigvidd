// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.UserMapping;

namespace IntegrationTests.Admin;

public class AdminUserMappingsControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string AuthenticatedUser = "firebase-uid-12346";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public AdminUserMappingsControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    [Fact]
    public async Task GetMappings_OnAHostThatDoesNotShareServices_ReturnsNotFound()
    {
        // Act
        var response = await AdminClient().GetAsync("/api/v1/admin/user-mappings", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SaveMapping_OnAHostThatDoesNotShareServices_ReturnsNotFoundAndChangesNoUser()
    {
        // Arrange
        var request = new SaveUserMappingRequest { KeycloakSubjectId = "staging-sub", NickName = "Vandrar", Email = "v@example.com" };

        // Act
        var response = await AdminClient().PutAsJsonAsync("/api/v1/admin/user-mappings/1", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SaveMapping_WithANicknameOver20Characters_ReturnsBadRequest()
    {
        // Arrange
        var request = new SaveUserMappingRequest { KeycloakSubjectId = "staging-sub", NickName = new string('a', 21), Email = "v@example.com" };

        // Act
        var response = await AdminClient().PutAsJsonAsync("/api/v1/admin/user-mappings/1", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
