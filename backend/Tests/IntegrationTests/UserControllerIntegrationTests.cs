using System.Net;
using System.Net.Http.Json;
using WebDataContracts.RequestModels;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace IntegrationTests;

public class UserControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public UserControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task GetUserFavorites_ReturnsSuccess()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{userIdentifier}/favorites");
        var favorites = await response.Content.ReadFromJsonAsync<List<UserTrailCollectionResponse>>();
    
        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(favorites);
        Assert.Equal(2, favorites.Count);
        Assert.IsAssignableFrom<IEnumerable<UserTrailCollectionResponse>>(favorites);
    }

    [Fact]
    public async Task GetUserFavorites_WhenNoFavoritesExists_ReturnsEmptyList()
    {
        // Arrange
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{userIdentifier}/favorites");
        var favorites = await response.Content.ReadFromJsonAsync<List<UserTrailCollectionResponse>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(favorites);
        Assert.Empty(favorites);
        Assert.IsAssignableFrom<IEnumerable<UserTrailCollectionResponse>>(favorites);
    }

    [Fact]
    public async Task GetUserFavorites_ForInvalidUser_ReturnsNotFound()
    {
        // Arrange
        var invalidUserIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{invalidUserIdentifier}/favorites");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetFavorites_WithValidUser_ReturnsWishListWithImages()
    {
        // Arrange 
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{userIdentifier}/favorites");
        var favorites = await response.Content.ReadFromJsonAsync<List<UserTrailCollectionResponse>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(favorites);
        Assert.NotEmpty(favorites);
        Assert.NotEmpty(favorites[0].TrailImages!);
    }

    [Fact]
    public async Task AddUserFavorite_ReturnsCreated()
    {
        // Arrange
        var userRequest = new AddToUserFavoritesRequest
        {
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            TrailIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/favorites");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task AddUserFavorite_WithInvalidUser_ReturnsNotFound()
    {
        // Arrange
        var userRequest = new AddToUserFavoritesRequest
        {
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6y",
            TrailIdentifier = "88b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/favorites");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddUserFavorite_WithInvalidTrail_ReturnsNotFound()
    {
        // Arrange
        var userRequest = new AddToUserFavoritesRequest
        {
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            TrailIdentifier = "88b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1u"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/favorites");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddUserFavorite_WithDuplicateTrail_ReturnsConflict()
    {
        // Arrange
        var userRequest = new AddToUserFavoritesRequest
        {
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            TrailIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/favorites");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_ReturnsNoContent()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
        var trailIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/{userIdentifier}/favorites/{trailIdentifier}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WithInvaldTrailIdentifier_ReturnsConflict()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
        var trailIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5y";

        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/{userIdentifier}/favorites/{trailIdentifier}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WithInvalidUserIdentifier_ReturnsNotfound()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d69";
        var trailIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/{userIdentifier}/favorites/{trailIdentifier}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetUserWishlist_ReturnsSuccess()
    {
        // Arrange
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{userIdentifier}/wishlist");
        var wishlist = await response.Content.ReadFromJsonAsync<List<UserTrailCollectionResponse>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(wishlist);
        Assert.Equal(2, wishlist.Count);
        Assert.IsAssignableFrom<IEnumerable<UserTrailCollectionResponse>>(wishlist);
    }

    [Fact]
    public async Task GetUserWishllist_WhenNoWishlistExists_ReturnsEmptyList()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{userIdentifier}/wishlist");
        var wishlist = await response.Content.ReadFromJsonAsync<List<UserTrailCollectionResponse>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(wishlist);
        Assert.Empty(wishlist);
        Assert.IsAssignableFrom<IEnumerable<UserTrailCollectionResponse>>(wishlist);
    }

    [Fact]
    public async Task GetWishList_WithValidUser_ReturnsWishListWithImages()
    {
        // Arrange 
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{userIdentifier}/wishlist");
        var wishList = await response.Content.ReadFromJsonAsync<List<UserTrailCollectionResponse>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(wishList);
        Assert.NotEmpty(wishList);
        Assert.NotEmpty(wishList[0].TrailImages!);    
    }

    [Fact]
    public async Task GetUserWishlist_ForInvalidUser_ReturnsNotFound()
    {
        // Arrange
        var invalidUserIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";

        // Act
        var response = await _client.GetAsync($"/api/v1/user/{invalidUserIdentifier}/wishlist");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddUserWishlist_ReturnsCreated()
    {
        // Arrange
        var userRequest = new AddToUserWishlistRequest
        {
            UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            TrailIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/wishlist");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task AddUserWishlist_WithInvalidUser_ReturnsNotFound()
    {
        // Arrange
        var userRequest = new AddToUserWishlistRequest
        {
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6u",
            TrailIdentifier = "88b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/wishlist");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddUserWishlist_WithInvalidTrail_ReturnsNotFound()
    {
        // Arrange
        var userRequest = new AddToUserWishlistRequest
        {
            UserIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            TrailIdentifier = "88b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1u"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/wishlist");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddUserWishlist_WithDuplicateTrail_ReturnsConflict()
    {
        // Arrange
        var userRequest = new AddToUserWishlistRequest
        {
            UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            TrailIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/user/wishlist");
        request.Content = JsonContent.Create(userRequest);

        // Act

        var response = await _client.SendAsync(request);
        // Assert

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_ReturnsNoContent()
    {
        // Arrange
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
        var trailIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";

        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/{userIdentifier}/wishlist/{trailIdentifier}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WithInvaldTrailIdentifier_ReturnsConflict()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
        var trailIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";

        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/{userIdentifier}/wishlist/{trailIdentifier}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WithInvalidUserIdentifier_ReturnsNotfound()
    {
        // Arrange
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d69";
        var trailIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/{userIdentifier}/wishlist/{trailIdentifier}");

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

}