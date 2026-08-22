using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.AdminController;

/// <summary>
/// The export streams the whole environment and the import replaces it, so both are
/// gated on the admin realm role rather than plain authentication.
/// </summary>
public class AdminControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen

    public AdminControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task Export_WhenUnauthenticated_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.GetAsync("/api/v1/admin/export", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Export_WithoutAdminRole_ShouldReturnForbidden()
    {
        // Arrange — signed in as an ordinary app user, no realm role.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync("/api/v1/admin/export", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Import_WithoutAdminRole_ShouldReturnForbidden()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var content = new ByteArrayContent([0x50, 0x4B, 0x03, 0x04]);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/zip");

        // Act
        var response = await client.PostAsync("/api/v1/admin/import", content, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
