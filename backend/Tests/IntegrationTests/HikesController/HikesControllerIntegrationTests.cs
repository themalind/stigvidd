using FluentAssertions;
using Namotion.Reflection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace IntegrationTests.HikesController;

public class HikesControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string BASE_URL = "/api/v1/hikes/";
    private const string AUTHENTICATED_USER = "firebase-uid-12345";
    private const string NOT_AUTHENTICATED_USER = "not-a-valid-uid";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public HikesControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnOk_WhenIdentifierHasMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var hikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";
        
        // Act
        var response = await client.GetAsync($"{BASE_URL}{hikeIdentifier}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnNotFound_WhenIdentifierHasNoMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        var hikeIdentifier = "not-a-uid";

        // Act
        var response = await client.GetAsync($"{BASE_URL}{hikeIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        var hikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";

        // Act
        var response = await client.GetAsync($"{BASE_URL}{hikeIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnOk_WhenNoQueryIsUsed()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync(BASE_URL);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnOk_WhenQueryIsUsedAndHasMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var response = await client.GetAsync($"{BASE_URL}?createdBy={userIdentifier}");
        var responseObject = await response.Content.ReadFromJsonAsync<HikeResponse[]>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        responseObject.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnOk_WhenQueryIsUsedAndHasNoMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var userIdentifier = "not-a-valid-user";

        // Act
        var response = await client.GetAsync($"{BASE_URL}?createdBy={userIdentifier}");
        var responseObject = await response.Content.ReadFromJsonAsync<HikeResponse[]>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        responseObject.Should().HaveCount(0);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);

        // Act
        var response = await client.GetAsync(BASE_URL);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldReturnCreated_WhenHikeIsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var request = new CreateHikeRequest
        {
            Name = "TestHike1",
            HikeLength = 1000,
            Duration = 60000,
            Coordinates = "[]"
        };

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldReturnBadRequest_WhenBodyIsInvalid()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var request = new StringContent
        (
            "this-is-not-valid",
            Encoding.UTF8,
            "application/json"
        );

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);
        
        var request = new CreateHikeRequest
        {
            Name = "TestHike1",
            HikeLength = 1000,
            Duration = 60000,
            Coordinates = "[]"
        };

        // Act
        var response = await client.PostAsJsonAsync(BASE_URL, request);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnNoContent_WhenHikeIsDeleted()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var hikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}{hikeIdentifier}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnNotFound_WhenHikeIsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var hikeIdentifier = "not-a-valid-hike-identifier";

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}{hikeIdentifier}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnUnauthorized_WhenUserIsNotCreator()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", AUTHENTICATED_USER);
        
        var hikeIdentifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13";

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}{hikeIdentifier}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldReturnUnauthorized_WhenUserNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NOT_AUTHENTICATED_USER);
        
        var hikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}{hikeIdentifier}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}