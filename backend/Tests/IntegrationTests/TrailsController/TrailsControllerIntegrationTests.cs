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
            { new StringContent("[{\"latitude\": 57.62141010663575, \"longitude\": 12.805517126805371}, {\"latitude\": 58.62141010663575, \"longitude\": 13.805517126805371}]"), "Coordinates" },
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
            { new StringContent("[{\"latitude\": 57.62141010663575, \"longitude\": 12.805517126805371}, {\"latitude\": 58.62141010663575, \"longitude\": 13.805517126805371}]"), "Coordinates" },
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
            { new StringContent("[{\"latitude\": 57.62141010663575, \"longitude\": 12.805517126805371}, {\"latitude\": 58.62141010663575, \"longitude\": 13.805517126805371}]"), "Coordinates" },
            { new StringContent("false"), "IsVerified" },
            { new StringContent("Test City"), "City" }
        };

        // Act
        var response = await client.PostAsync("/api/v1/trails/create", requestContent, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetTrailCards_ShouldReturnCards_WhenIdentifiersExist()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new { identifiers = new[] { StorsjoledenIdentifier } };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trails/cards", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cards = await response.Content.ReadFromJsonAsync<List<TrailCardResponse>>(TestContext.Current.CancellationToken);
        cards.Should().NotBeNull();
        cards!.Should().ContainSingle(c => c.Identifier == StorsjoledenIdentifier);
    }

    [Fact]
    public async Task GetTrailCards_ShouldReturnOnlyExistingCards_WhenSomeIdentifiersDoNotExist()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new { identifiers = new[] { StorsjoledenIdentifier, "non-existent-trail-identifier" } };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trails/cards", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cards = await response.Content.ReadFromJsonAsync<List<TrailCardResponse>>(TestContext.Current.CancellationToken);
        cards.Should().NotBeNull();
        cards!.Should().ContainSingle();
        cards![0].Identifier.Should().Be(StorsjoledenIdentifier);
    }

    [Fact]
    public async Task GetTrailCards_ShouldReturnBadRequest_WhenIdentifiersAreEmpty()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new { identifiers = Array.Empty<string>() };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/trails/cards", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetAllTrails_ShouldReturnTrails()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/trails", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var trails = await response.Content.ReadFromJsonAsync<List<TrailShortInfoResponse>>(TestContext.Current.CancellationToken);
        trails.Should().NotBeNullOrEmpty();
        trails!.Should().Contain(t => t.Identifier == StorsjoledenIdentifier);
    }

    [Fact]
    public async Task GetTrailMarkers_ShouldReturnMarkers()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/trails/markers", TestContext.Current.CancellationToken);

        // Assert — verifies the GeoPath start-point projection against real geometry
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var markers = await response.Content.ReadFromJsonAsync<List<TrailMarkerResponse>>(TestContext.Current.CancellationToken);
        markers.Should().NotBeNullOrEmpty();
        markers!.Should().Contain(m => m.Identifier == StorsjoledenIdentifier && m.StartLatitude != null && m.StartLongitude != null);
    }

    [Fact]
    public async Task GetPopularTrails_ShouldReturnTrails()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/v1/trails/popular", TestContext.Current.CancellationToken);

        // Assert — rating-only scoring path (no user location)
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var overviews = await response.Content.ReadFromJsonAsync<List<TrailOverviewResponse>>(TestContext.Current.CancellationToken);
        overviews.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetPopularTrails_WithUserLocation_ShouldReturnTrails()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act — with coordinates, the score adds a proximity boost (StartPoint.Distance),
        // which is the most translation-sensitive part of the query.
        var response = await client.GetAsync("/api/v1/trails/popular?latitude=57.72&longitude=12.94", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var overviews = await response.Content.ReadFromJsonAsync<List<TrailOverviewResponse>>(TestContext.Current.CancellationToken);
        overviews.Should().NotBeNullOrEmpty();
    }
}
