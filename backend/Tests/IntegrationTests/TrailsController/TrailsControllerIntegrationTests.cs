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
        var response = await client.GetAsync($"/api/v1/trails/non-existent-trail-identifier");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetCoordinatesByTrailIdentifier_ShouldReturnCoordinates_WhenTrailExists()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}/coordinates");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetCoordinatesByTrailIdentifier_ShouldReturnNotFound_WhenTrailDoesNotExist()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/non-existent-trail-identifier/coordinates");

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
        var response = await client.PostAsync("/api/v1/trails/create", requestContent);

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
        var response = await client.PostAsync("/api/v1/trails/create", requestContent);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetTrailByIdentifier_ShouldReturnCorrectTrail_WhenTrailExists()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"/api/v1/trails/{StorsjoledenIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var trail = await response.Content.ReadFromJsonAsync<TrailResponse>();
        trail.Should().NotBeNull();
        trail.Identifier.Should().Be(StorsjoledenIdentifier);
        trail.Name.Should().Be("Storsjöleden");
        trail.City.Should().Be("Viskafors");
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
        var response = await client.PostAsync("/api/v1/trails/create", requestContent);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
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
        var response = await client.PostAsync("/api/v1/trails/create", requestContent);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
