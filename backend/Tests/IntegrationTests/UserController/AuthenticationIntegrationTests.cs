using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.User;

namespace IntegrationTests.UserController;

public class AuthenticationIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public AuthenticationIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
        // Client will be created in each test to allow different authentication settings
    }

    [Fact]
    public async Task CreateStigviddUser_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var createUserRequest = new CreateUserRequest
        {
            Email = "test1@test.local",
            NickName = "Testsson",
            FirebaseUid = "firebase-uid-12345"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/user/create", createUserRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateStigviddUser_WhenAuthenticated_ReturnsOK()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", "test-token");

        var createUserRequest = new CreateUserRequest
        {
            Email = "test2@test.local",
            NickName = "Test",
            FirebaseUid = "firebase-uid-112233"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/user/create", createUserRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task GetStigViddUser_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();     
        var identifier = "firebase-uid-12345";

        // Act
        var response = await client.GetAsync($"/api/v1/user/{identifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetUserFavorites_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

        // Act
        var response = await client.GetAsync($"/api/v1/user/{userIdentifier}/favorites");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetUserWishlist_WhenNotAuthenticated_ReturnsUnAuthorized()
    {
        // Arrange 
        var client = _factory.CreateClient();
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

        // Act
        var response = await client.GetAsync($"/api/v1/user/{userIdentifier}/wishlist");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddToUserFavorites_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var favoriteRequest = new AddToUserFavoritesRequest
        {
            TrailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/user/favorites", favoriteRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddToUserWishlist_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var wishlistRequest = new AddToUserWishlistRequest
        {
            TrailIdentifier = "11a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/user/wishlist", wishlistRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

        // Act
        var response = await client.DeleteAsync($"/api/v1/user/{userIdentifier}/favorites/{trailIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WhenNotAuthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var response = await client.DeleteAsync($"/api/v1/user/{userIdentifier}/wishlist/{trailIdentifier}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
