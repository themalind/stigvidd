using FluentAssertions;
using ImageMagick;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace IntegrationTests.Admin;

/// <summary>
/// The write side of the admin dashboard's trail editor. The authorization guard itself
/// lives in <see cref="AdminAuthorizationIntegrationTests"/>; these cover the actions.
/// </summary>
public class AdminTrailsControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string TrailsRoute = "/api/v1/admin/trails";

    /// <summary>A seeded user — has both a Keycloak subject and a StigVidd user row.</summary>
    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    /// <summary>
    /// An admin who exists only in Keycloak, with no StigVidd user row — which is what
    /// DEPLOYMENT.md tells you to create. Every admin action must work for them.
    /// </summary>
    private const string KeycloakOnlyAdmin = "keycloak-sub-with-no-user-row";

    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Trail 2
    private const string StorsjoledenImageIdentifier = "img-storlsjon-1";                  // one of Trail 2's images
    private const string NonExistentIdentifier = "00000000-0000-0000-0000-000000000000";

    public AdminTrailsControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient CreateAdminClient(string subjectId = AuthenticatedUser)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subjectId);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    private static UpdateTrailRequest ValidUpdateRequest(string name = "Uppdaterat ledsnamn") => new()
    {
        Name = name,
        TrailLength = 9.5m,
        Classification = 2,
        Accessibility = true,
        City = "Viskafors",
    };

    private static MultipartFormDataContent BuildUpload(string fieldName, uint width = 200, uint height = 150)
    {
        using var image = new MagickImage(new MagickColor("#112233"), width, height);
        image.Format = MagickFormat.Png;

        var imageContent = new ByteArrayContent(image.ToByteArray());
        imageContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");

        return new MultipartFormDataContent
        {
            { imageContent, fieldName, "photo.png" },
            { new StringContent("100"), "MaxWidth" },
            { new StringContent("100"), "MaxHeight" },
            { new StringContent("70"), "Quality" },
            { new StringContent("webp"), "Format" },
        };
    }

    [Fact]
    public async Task UpdateTrail_WithAdminRole_ShouldReturnOkAndPersistTheChange()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}", ValidUpdateRequest(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var trail = await response.Content.ReadFromJsonAsync<TrailResponse>(TestContext.Current.CancellationToken);
        trail.Should().NotBeNull();
        trail!.Name.Should().Be("Uppdaterat ledsnamn");

        var reread = await client.GetFromJsonAsync<TrailResponse>(
            $"/api/v1/trails/{StorsjoledenIdentifier}", TestContext.Current.CancellationToken);
        reread!.Name.Should().Be("Uppdaterat ledsnamn");
    }

    /// <summary>
    /// The dashboard never provisions a StigVidd user row (nothing in web/src calls
    /// GET api/v1/users), so holding the realm role has to be sufficient on its own.
    /// </summary>
    [Fact]
    public async Task UpdateTrail_AsAdminWithoutAStigViddUserRow_ShouldStillSucceed()
    {
        // Arrange
        var client = CreateAdminClient(KeycloakOnlyAdmin);

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}", ValidUpdateRequest(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UpdateTrail_WithoutAuthentication_ShouldReturnUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = null;

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}", ValidUpdateRequest(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateTrail_WithNonExistentTrail_ShouldReturnNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{NonExistentIdentifier}", ValidUpdateRequest(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetTrailSymbol_WithAdminRole_ShouldReturnThePresentableSymbolUrl()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PostAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}/symbol", BuildUpload("symbol"),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<SymbolUrlResponse>(TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        body!.SymbolUrl.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task SetTrailSymbol_WithNonExistentTrail_ShouldReturnNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PostAsync(
            $"{TrailsRoute}/{NonExistentIdentifier}/symbol", BuildUpload("symbol"),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteTrailImage_WithAdminRole_ShouldReturnNoContent()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.DeleteAsync(
            $"{TrailsRoute}/images/{StorsjoledenImageIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteTrailImage_WithNonExistentImage_ShouldReturnNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.DeleteAsync(
            $"{TrailsRoute}/images/{NonExistentIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>The anonymous shape of AdminTrailsController.SetTrailSymbol's response body.</summary>
    private sealed record SymbolUrlResponse(string SymbolUrl);
}
