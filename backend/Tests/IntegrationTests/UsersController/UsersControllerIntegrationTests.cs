using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.User;
using WebDataContracts.ResponseModels.User;

namespace IntegrationTests.UsersController;

public class UsersControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    // Test user identifiers matching seeded data in Utilities.cs
    private const string UserWithWishlist = "firebase-uid-12345";  // User 1: NaturElskaren
    private const string UserWithFavorites = "firebase-uid-12346"; // User 2: VandrarVennen
    private const string NonExistingUser = "firebase-uid-99999";   // No matching user in DB

    // Trails
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";    // in VandrarVennen's favorites
    private const string VildmarksledenArasIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"; // in NaturElskaren's wishlist
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";         // not in any tested user's lists
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";       // not in NaturElskaren's wishlist
    private const string NonExistentTrailIdentifier = "88b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d"; // does not exist in DB
    #endregion

    public UsersControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task GetUserFavorites_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // Act
        var response = await client.GetAsync($"/api/v1/users/favorites");
        var favorites = await response.Content.ReadFromJsonAsync<List<UserFavoritesTrailResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        favorites.Should().NotBeNull();
        favorites.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetUserFavorites_WhenNoFavoritesExists_ReturnsEmptyList()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // Act
        var response = await client.GetAsync($"/api/v1/users/favorites");
        var favorites = await response.Content.ReadFromJsonAsync<List<UserFavoritesTrailResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        favorites.Should().NotBeNull();
        favorites.Should().BeEmpty();
    }

    [Fact]
    public async Task GetFavorites_WithValidUser_ReturnsWishListWithImages()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // Act
        var response = await client.GetAsync($"/api/v1/users/favorites");
        var favorites = await response.Content.ReadFromJsonAsync<List<UserFavoritesTrailResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        favorites.Should().NotBeNull();
        favorites.Should().NotBeEmpty();
        favorites[0].TrailImages.Should().NotBeEmpty();
    }

    [Fact]
    public async Task AddUserFavorite_ReturnsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var userRequest = new AddToUserFavoritesRequest
        {
            TrailIdentifier = GesebolIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddUserFavorite_WithInvalidIdentifierFormat_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var userRequest = new AddToUserFavoritesRequest
        {
            TrailIdentifier = "invalid-format"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddUserFavorite_WithNonExistingUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", NonExistingUser);

        var userRequest = new AddToUserFavoritesRequest
        {
            TrailIdentifier = GesebolIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddUserFavorite_WithInvalidTrail_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var userRequest = new AddToUserFavoritesRequest
        {
            TrailIdentifier = NonExistentTrailIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AddUserFavorite_WithDuplicateTrail_ReturnsConflict()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // StorsjoledenIdentifier is already in VandrarVennen's favorites
        var userRequest = new AddToUserFavoritesRequest
        {
            TrailIdentifier = StorsjoledenIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_ReturnsNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // StorsjoledenIdentifier is in VandrarVennen's favorites
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/favorites/{StorsjoledenIdentifier}");
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WithInvaldTrailIdentifier_ReturnsConflict()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/favorites/22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5y");
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WithNonExistingUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", NonExistingUser);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/favorites/{StorsjoledenIdentifier}");
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetUserWishlist_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // Act
        var response = await client.GetAsync($"/api/v1/users/wishlist");
        var wishlist = await response.Content.ReadFromJsonAsync<List<UserWishlistTrailResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        wishlist.Should().NotBeNull();
        wishlist.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetUserWishllist_WhenNoWishlistExists_ReturnsEmptyList()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // Act
        var response = await client.GetAsync($"/api/v1/users/wishlist");
        var wishlist = await response.Content.ReadFromJsonAsync<List<UserWishlistTrailResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        wishlist.Should().NotBeNull();
        wishlist.Should().BeEmpty();
    }

    [Fact]
    public async Task GetWishList_WithValidUser_ReturnsWishListWithImages()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // Act
        var response = await client.GetAsync($"/api/v1/users/wishlist");
        var wishList = await response.Content.ReadFromJsonAsync<List<UserWishlistTrailResponse>>();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        wishList.Should().NotBeNull();
        wishList.Should().NotBeEmpty();
        wishList[0].TrailImages.Should().NotBeEmpty();
    }

    [Fact]
    public async Task AddUserWishlist_ReturnsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var userRequest = new AddToUserWishlistRequest
        {
            TrailIdentifier = GesebolIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task AddUserWishlist_WithNonExistingUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", NonExistingUser);

        var userRequest = new AddToUserWishlistRequest
        {
            TrailIdentifier = GesebolIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AddUserWishlist_WithInvalidTrail_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var userRequest = new AddToUserWishlistRequest
        {
            TrailIdentifier = NonExistentTrailIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AddUserWislist_WithInvalidIdentifierFormat_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var userRequest = new AddToUserWishlistRequest
        {
            TrailIdentifier = "invalid-format"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddUserWishlist_WithDuplicateTrail_ReturnsConflict()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // VildmarksledenArasIdentifier is already in NaturElskaren's wishlist
        var userRequest = new AddToUserWishlistRequest
        {
            TrailIdentifier = VildmarksledenArasIdentifier
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_ReturnsNoContent()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // VildmarksledenArasIdentifier is in NaturElskaren's wishlist
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/wishlist/{VildmarksledenArasIdentifier}");
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WithInvaldTrailIdentifier_ReturnsConflict()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // HultaforsIdentifier is NOT in NaturElskaren's wishlist
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/wishlist/{HultaforsIdentifier}");
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WithNonExistingUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", NonExistingUser);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/wishlist/{VildmarksledenArasIdentifier}");
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateStigViddUser_WithValidRequest_ReturnsCreated()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", "firebase-uid-new-user-1");

        var userRequest = new CreateUserRequest
        {
            NickName = "newuser",
            Email = "newuser@test.local"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/create", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CreateStigViddUser_WithInvalidEmail_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", "firebase-uid-new-user-2");

        var userRequest = new CreateUserRequest
        {
            NickName = "invaliduser",
            Email = "invalid.email.com"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/create", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateStigViddUser_WithNoName_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", "firebase-uid-new-user-3");

        var userRequest = new CreateUserRequest
        {
            NickName = "",
            Email = "test@test.local"
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/users/create", userRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
