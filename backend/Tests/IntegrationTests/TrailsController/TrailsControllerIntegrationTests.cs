using FluentAssertions;
using Microsoft.AspNetCore.Http;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Trail;

namespace IntegrationTests.TrailsController;

public class TrailsControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen

    // Trails
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Trail 2
    #endregion

    public TrailsControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetTrailByIdentifier_ShouldReturnNotFound_WhenTrailDoesNotExist()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/non-existent-trail-identifier", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetCoordinatesByTrailIdentifier_ShouldReturnCoordinates_WhenTrailExists()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}/coordinates", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetCoordinatesByTrailIdentifier_ShouldReturnNotFound_WhenTrailDoesNotExist()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/non-existent-trail-identifier/coordinates", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AddTrail_ShouldCreateTrail_WhenRequestIsValid()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }; // minimal JPEG header

        var trailSymbolImageContent = new ByteArrayContent(fakeImageBytes);
        trailSymbolImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var trailImageContent = new ByteArrayContent(fakeImageBytes);
        trailImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var requestContent = new MultipartFormDataContent
        {
            { new StringContent("Test Trail"), "Name" },
            { new StringContent("5"), "TrailLength" },
            { new StringContent("1"), "Classification" },
            { new StringContent("false"), "Accessibility" },
            { new StringContent("Testinfo"), "AccessibilityInfo" },
            { new StringContent("test-trail-symbol"), "TrailSymbol" },
            { new StringContent("Test description"), "Description" },
            { new StringContent("Test full description"), "FullDescription" },
            { new StringContent("[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]"), "Tags" },
            { trailSymbolImageContent, "trailSymbolImage", "trailSymbol.jpg" },
            { trailImageContent, "images", "trail-image-1.jpg" },
            { new StringContent("[{latitude=57.62141010663575, longitude= 12.805517126805371,}]"), "Coordinates" },
            { new StringContent("false"), "IsVerified" },
            { new StringContent("Test City"), "City" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/trails/create", requestContent, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddTrail_ShouldReturnBadRequest_WhenRequestIsInvalid()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };

        var trailSymbolImageContent = new ByteArrayContent(fakeImageBytes);
        trailSymbolImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var trailImageContent = new ByteArrayContent(fakeImageBytes);
        trailImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var requestContent = new MultipartFormDataContent
        {
            { new StringContent("Test trail"), "Name" },
            { new StringContent("-15"), "TrailLength" }, // invalid: negative length
            { new StringContent("1"), "Classification" },
            { new StringContent("false"), "Accessibility" },
            { new StringContent("Testinfo"), "AccessibilityInfo" },
            { new StringContent("test-trail-symbol"), "TrailSymbol" },
            { new StringContent("Test description"), "Description" },
            { new StringContent("Test full description"), "FullDescription" },
            { new StringContent("[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]"), "Tags" },
            { trailSymbolImageContent, "trailSymbolImage", "trailSymbol.jpg" },
            { trailImageContent, "images", "trail-image-1.jpg" },
            { new StringContent("[{latitude=57.62141010663575, longitude= 12.805517126805371,}]"), "Coordinates" },
            { new StringContent("false"), "IsVerified" },
            { new StringContent("Test City"), "City" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/trails/create", requestContent, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetTrailByIdentifier_ShouldReturnCorrectTrail_WhenTrailExists()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var trail = await response.Content.ReadFromJsonAsync<TrailResponse>(TestContext.Current.CancellationToken);
        trail.Should().NotBeNull();
        trail!.Identifier.Should().Be(StorsjoledenIdentifier);
        trail!.Name.Should().Be("Storsjöleden");
        trail!.City.Should().Be("Viskafors");
    }

    [Fact]
    public async Task AddTrail_ShouldReturnBadRequest_WhenRequiredFieldsAreMissing()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };

        var trailSymbolImageContent = new ByteArrayContent(fakeImageBytes);
        trailSymbolImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var trailImageContent = new ByteArrayContent(fakeImageBytes);
        trailImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var requestContent = new MultipartFormDataContent
        {
            // Name and Coordinates are omitted (both required)
            { new StringContent("15"), "TrailLength" },
            { new StringContent("1"), "Classification" },
            { new StringContent("false"), "Accessibility" },
            { new StringContent("Testinfo"), "AccessibilityInfo" },
            { new StringContent("test-trail-symbol"), "TrailSymbol" },
            { new StringContent("Test description"), "Description" },
            { new StringContent("Test full description"), "FullDescription" },
            { new StringContent("[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]"), "Tags" },
            { trailSymbolImageContent, "trailSymbolImage", "trailSymbol.jpg" },
            { trailImageContent, "images", "trail-image-1.jpg" },
            { new StringContent("false"), "IsVerified" },
            { new StringContent("Test City"), "City" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/trails/create", requestContent, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetTrailCard_ShouldReturnCard_WhenTrailExists()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — Storsjöleden (Trail 2): verified, has one review (3.5) and two images
        var response = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}/card", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var card = await response.Content.ReadFromJsonAsync<TrailCardResponse>(TestContext.Current.CancellationToken);
        card.Should().NotBeNull();
        card!.Identifier.Should().Be(StorsjoledenIdentifier);
        card!.Name.Should().Be("Storsjöleden");
        card!.AverageRating.Should().Be(3.5M);
        card!.Image.Should().NotBeNull();
        card!.Image!.Identifier.Should().Be("img-storlsjon-1");
    }

    [Fact]
    public async Task GetTrailCard_ShouldReturnNotFound_WhenTrailDoesNotExist()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/trails/non-existent-trail-identifier/card", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetTrailPaths_ShouldReturnOk_WithValidBounds()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — broad bounds covering the test area; seed trails may have no GeoPath set,
        // which is acceptable: the endpoint should return 200 with an empty or populated array
        var response = await client.GetAsync(
            "/api/v1/trails/paths?minLat=55.0&minLon=10.0&maxLat=60.0&maxLon=15.0",
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var paths = await response.Content.ReadFromJsonAsync<IReadOnlyCollection<TrailPathResponse>>(TestContext.Current.CancellationToken);
        paths.Should().NotBeNull();
    }

    [Fact]
    public async Task GetTrailCard_ShouldReturnImageUrlWithBaseUrl()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — Storsjöleden (Trail 2) has images in the seed data
        var response = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}/card", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var card = await response.Content.ReadFromJsonAsync<TrailCardResponse>(TestContext.Current.CancellationToken);
        card.Should().NotBeNull();
        card!.Image.Should().NotBeNull();
        card!.Image!.ImageUrl.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task AddTrail_WithNoTrailImages_ShouldCreateTrail()
    {
        // Arrange — symbol image is required by the controller, but trail images are optional
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        var fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };
        var symbolImageContent = new ByteArrayContent(fakeImageBytes);
        symbolImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var requestContent = new MultipartFormDataContent
        {
            { new StringContent("Trail Without Trail Images"), "Name" },
            { new StringContent("3"), "TrailLength" },
            { new StringContent("1"), "Classification" },
            { new StringContent("false"), "Accessibility" },
            { new StringContent("No info"), "AccessibilityInfo" },
            { new StringContent("test-symbol"), "TrailSymbol" },
            { new StringContent("A trail with no trail images"), "Description" },
            { new StringContent("Full description"), "FullDescription" },
            { new StringContent("[\"skog\"]"), "Tags" },
            { symbolImageContent, "trailSymbolImage", "symbol.jpg" },
            { new StringContent("[{latitude=57.62141010663575, longitude= 12.805517126805371,}]"), "Coordinates" },
            { new StringContent("false"), "IsVerified" },
            { new StringContent("Test City"), "City" }
            // no "images" parts — trail image collection is optional
        };

        // Act
        var response = await client.PostAsync("/api/v1/trails/create", requestContent, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddTrail_ShouldReturnUnauthorized_WhenUserIsNotAuthenticated()
    {
        // Arrange
        var client = _factory.CreateClient();

        var fakeImageBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };

        var trailSymbolImageContent = new ByteArrayContent(fakeImageBytes);
        trailSymbolImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var trailImageContent = new ByteArrayContent(fakeImageBytes);
        trailImageContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");

        var requestContent = new MultipartFormDataContent
        {
            { new StringContent("Test Trail"), "Name" },
            { new StringContent("5"), "TrailLength" },
            { new StringContent("1"), "Classification" },
            { new StringContent("false"), "Accessibility" },
            { new StringContent("Testinfo"), "AccessibilityInfo" },
            { new StringContent("test-trail-symbol"), "TrailSymbol" },
            { new StringContent("Test description"), "Description" },
            { new StringContent("Test full description"), "FullDescription" },
            { new StringContent("[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]"), "Tags" },
            { trailSymbolImageContent, "trailSymbolImage", "trailSymbol.jpg" },
            { trailImageContent, "images", "trail-image-1.jpg" },
            { new StringContent("[{latitude=57.62141010663575, longitude= 12.805517126805371,}]"), "Coordinates" },
            { new StringContent("false"), "IsVerified" },
            { new StringContent("Test City"), "City" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/trails/create", requestContent, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
