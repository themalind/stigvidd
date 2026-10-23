// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
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
    private const string TrailWithoutImagesIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Trail 3

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
        trail.Name.Should().Be("Uppdaterat ledsnamn");

        var reread = await client.GetFromJsonAsync<TrailResponse>(
            $"/api/v1/trails/{StorsjoledenIdentifier}", TestContext.Current.CancellationToken);
        reread.Should().NotBeNull();
        reread.Name.Should().Be("Uppdaterat ledsnamn");
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
    public async Task UpdateTrail_WithLinks_ReplacesTheLinksAndKeepsTheIdentifiersOfEditedOnes()
    {
        // Arrange
        var client = CreateAdminClient();
        var route = $"{TrailsRoute}/{TrailWithoutImagesIdentifier}";
        var first = ValidUpdateRequest();
        first.Links =
        [
            new UpdateTrailLinkRequest { Title = "Kommunen", Link = "https://www.boras.se" },
            new UpdateTrailLinkRequest { Title = "Tas bort", Link = "https://example.com/old" },
        ];

        var created = await (await client.PutAsJsonAsync(route, first, TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<TrailResponse>(TestContext.Current.CancellationToken);
        created.Should().NotBeNull();
        created.TrailLinksResponse.Should().NotBeNull();
        var kommunen = created.TrailLinksResponse.Single(l => l.Title == "Kommunen");

        var second = ValidUpdateRequest();
        second.Links =
        [
            new UpdateTrailLinkRequest { Identifier = kommunen.Identifier, Title = "Borås Stad", Link = "https://www.boras.se/friluftsliv" },
            new UpdateTrailLinkRequest { Title = "Ny", Link = "https://example.com/new" },
        ];

        // Act
        var response = await client.PutAsJsonAsync(route, second, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var reread = await client.GetFromJsonAsync<TrailResponse>(route, TestContext.Current.CancellationToken);
        reread.Should().NotBeNull();
        reread.TrailLinksResponse.Should().NotBeNull();
        reread.TrailLinksResponse.Select(l => (l.Title, l.Link)).Should().BeEquivalentTo(
        [
            ("Borås Stad", "https://www.boras.se/friluftsliv"),
            ("Ny", "https://example.com/new"),
        ]);
        reread.TrailLinksResponse.Single(l => l.Title == "Borås Stad").Identifier.Should().Be(kommunen.Identifier);
    }

    [Fact]
    public async Task UpdateTrail_WithoutLinks_LeavesTheExistingLinksUntouched()
    {
        // Arrange
        var client = CreateAdminClient();
        var route = $"{TrailsRoute}/{TrailWithoutImagesIdentifier}";
        var withLinks = ValidUpdateRequest();
        withLinks.Links = [new UpdateTrailLinkRequest { Title = "Kommunen", Link = "https://www.boras.se" }];
        await client.PutAsJsonAsync(route, withLinks, TestContext.Current.CancellationToken);

        // Act
        var response = await client.PutAsJsonAsync(route, ValidUpdateRequest(), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var reread = await client.GetFromJsonAsync<TrailResponse>(route, TestContext.Current.CancellationToken);
        reread.Should().NotBeNull();
        reread.TrailLinksResponse.Should().NotBeNull();
        reread.TrailLinksResponse.Select(l => l.Title).Should().BeEquivalentTo(["Kommunen"]);
    }

    [Fact]
    public async Task UpdateTrail_WithANonHttpLink_ShouldReturnBadRequest()
    {
        // Arrange
        var client = CreateAdminClient();
        var request = ValidUpdateRequest();
        request.Links = [new UpdateTrailLinkRequest { Title = "Skript", Link = "javascript:alert(1)" }];

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{TrailWithoutImagesIdentifier}", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
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
        body.SymbolUrl.Should().NotBeNullOrWhiteSpace();
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

    [Fact]
    public async Task SetTrailVerified_RoundTrip_HidesAndRestoresTheTrailForThePublicButNotForTheAdmin()
    {
        // Arrange
        var client = CreateAdminClient();
        var ctoken = TestContext.Current.CancellationToken;

        // Act
        var deactivate = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}/verified", new SetTrailVerifiedRequest { IsVerified = false }, ctoken);

        // Assert
        deactivate.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var publicRead = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}", ctoken);
        publicRead.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var adminRead = await client.GetFromJsonAsync<TrailResponse>($"{TrailsRoute}/{StorsjoledenIdentifier}", ctoken);
        adminRead.Should().NotBeNull();
        adminRead.IsVerified.Should().BeFalse();

        var adminList = await client.GetFromJsonAsync<List<AdminTrailListItemResponse>>(TrailsRoute, ctoken);
        adminList.Should().NotBeNull();
        adminList.Should().ContainSingle(t => t.Identifier == StorsjoledenIdentifier)
            .Which.IsVerified.Should().BeFalse();

        // Act
        var activate = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}/verified", new SetTrailVerifiedRequest { IsVerified = true }, ctoken);

        // Assert
        activate.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var publicReread = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}", ctoken);
        publicReread.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAllTrails_ReportsWhatEachTrailIsMissing()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var trails = await client.GetFromJsonAsync<List<AdminTrailListItemResponse>>(
            TrailsRoute, TestContext.Current.CancellationToken);

        // Assert
        trails.Should().NotBeNull();
        var storsjoleden = trails.Should().ContainSingle(t => t.Identifier == StorsjoledenIdentifier).Subject;
        storsjoleden.HasImages.Should().BeTrue();
        storsjoleden.HasSymbol.Should().BeTrue();
        storsjoleden.HasDescription.Should().BeTrue();
        storsjoleden.HasFullDescription.Should().BeFalse();
        storsjoleden.HasExampleImages.Should().BeTrue();
        storsjoleden.CreatedAt.Should().NotBe(default);

        var withoutImages = trails.Should().ContainSingle(t => t.Identifier == TrailWithoutImagesIdentifier).Subject;
        withoutImages.HasImages.Should().BeFalse();
        withoutImages.HasExampleImages.Should().BeFalse();
    }

    [Fact]
    public async Task SetTrailVerified_WithNonExistentTrail_ShouldReturnNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{NonExistentIdentifier}/verified", new SetTrailVerifiedRequest { IsVerified = true },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetTrailVerified_WithoutTheFlag_ShouldReturnBadRequest()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}/verified", new { }, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetTrailPath_ForAnUnverifiedTrail_ReturnsLongitudeLatitudePairs()
    {
        // Arrange
        var client = CreateAdminClient();
        await client.PutAsJsonAsync(
            $"{TrailsRoute}/{StorsjoledenIdentifier}/verified",
            new SetTrailVerifiedRequest { IsVerified = false },
            TestContext.Current.CancellationToken);

        // Act
        var response = await client.GetAsync($"{TrailsRoute}/{StorsjoledenIdentifier}/path", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var path = await response.Content.ReadFromJsonAsync<AdminTrailPathResponse>(TestContext.Current.CancellationToken);
        path.Should().NotBeNull();
        path.Coordinates.Should().NotBeEmpty();
        path.Coordinates.Should().AllSatisfy(pair =>
        {
            pair.Should().HaveCount(2);
            pair[0].Should().BeInRange(10, 25, "Swedish longitudes come first");
            pair[1].Should().BeInRange(55, 70, "Swedish latitudes come second");
        });
    }

    [Fact]
    public async Task GetTrailPath_WithNonExistentTrail_ShouldReturnNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.GetAsync($"{TrailsRoute}/{NonExistentIdentifier}/path", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetTrail_WithNonExistentTrail_ShouldReturnNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.GetAsync($"{TrailsRoute}/{NonExistentIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>The anonymous shape of AdminTrailsController.SetTrailSymbol's response body.</summary>
    private sealed record SymbolUrlResponse(string SymbolUrl);
}
