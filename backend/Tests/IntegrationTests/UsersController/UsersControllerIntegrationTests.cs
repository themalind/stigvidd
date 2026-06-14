using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.User;
using WebDataContracts.ResponseModels.HikeShare;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.TrailObstacle;
using WebDataContracts.ResponseModels.User;

namespace IntegrationTests.UsersController;

public class UsersControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    // Test user identifiers matching seeded data in Utilities.cs
    private const string UserWithWishlist = "firebase-uid-12345";  // User 1: NaturElskaren
    private const string UserWithFavorites = "firebase-uid-12346"; // User 2: VandrarVennen
    private const string SkogsGreven = "firebase-uid-12347";       // User 3: SkogsGreven
    private const string NonExistingUser = "firebase-uid-99999";   // No matching user in DB

    // Trails
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";    // in VandrarVennen's favorites
    private const string VildmarksledenArasIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"; // in NaturElskaren's wishlist
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";         // not in any tested user's lists
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";       // not in NaturElskaren's wishlist
    private const string NonExistentTrailIdentifier = "88b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d"; // does not exist in DB

    // Hikes (for delete user tests)
    private const string SharedHikeIdentifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13";        // Hike 3: owned by VandrarVennen, shared with NaturElskaren
    private const string UnsharedHikeIdentifier = "c4d8a1b9-6f3e-4c72-8a5d-1e9b2f7c0a46";      // Hike 4: owned by VandrarVennen, not shared
    private const string SkogsGrevensHike5Identifier = "7a1e9c3d-2b4f-4d68-8c0a-5f2b7e1d9c32"; // Hike 5: shared by SkogsGreven with VandrarVennen

    // Reviews (for delete user tests)
    private const string TivedensTrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden — Review 1 lives here
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";      // Review 1: owned by VandrarVennen on Tiveden

    // Trail obstacles (for delete user tests)
    private const string TangaledensTrailIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Tångaleden — obstacle 3 lives here
    private const string Obstacle2Identifier = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";       // Obstacle 2: owned by VandrarVennen on Storsjöleden
    private const string Obstacle3Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";       // Obstacle 3: VandrarVennen voted on this
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";    // VandrarVennen's user Identifier (not Firebase UID)
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
        var response = await client.GetAsync($"/api/v1/users/favorites", TestContext.Current.CancellationToken);
        var favorites = await response.Content.ReadFromJsonAsync<List<UserFavoritesTrailResponse>>(TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/users/favorites", TestContext.Current.CancellationToken);
        var favorites = await response.Content.ReadFromJsonAsync<List<UserFavoritesTrailResponse>>(TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/users/favorites", TestContext.Current.CancellationToken);
        var favorites = await response.Content.ReadFromJsonAsync<List<UserFavoritesTrailResponse>>(TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/favorites", userRequest, TestContext.Current.CancellationToken);

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

        // Act — StorsjoledenIdentifier is in VandrarVennen's favorites
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/favorites/{StorsjoledenIdentifier}");
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveFromUserFavorites_WithInvaldTrailIdentifier_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/favorites/22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5y");
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
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
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/users/wishlist", TestContext.Current.CancellationToken);
        var wishlist = await response.Content.ReadFromJsonAsync<List<UserWishlistTrailResponse>>(TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/users/wishlist", TestContext.Current.CancellationToken);
        var wishlist = await response.Content.ReadFromJsonAsync<List<UserWishlistTrailResponse>>(TestContext.Current.CancellationToken);

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
        var response = await client.GetAsync($"/api/v1/users/wishlist", TestContext.Current.CancellationToken);
        var wishList = await response.Content.ReadFromJsonAsync<List<UserWishlistTrailResponse>>(TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/wishlist", userRequest, TestContext.Current.CancellationToken);

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

        // Act — VildmarksledenArasIdentifier is in NaturElskaren's wishlist
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/wishlist/{VildmarksledenArasIdentifier}");
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task RemoveFromUserWishlist_WithInvaldTrailIdentifier_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
         new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        // Act — HultaforsIdentifier is NOT in NaturElskaren's wishlist
        var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/users/wishlist/{HultaforsIdentifier}");
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
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
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/create", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/create", userRequest, TestContext.Current.CancellationToken);

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
        var response = await client.PostAsJsonAsync("/api/v1/users/create", userRequest, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // VandrarVennen (firebase-uid-12346) is used as the deletion candidate because they own
    // the full set of user-generated data at seed time:
    //   - Review 1 (with review images) — removed by DB cascade on user delete
    //   - Trail obstacle 2 (Flooding) — removed explicitly before user delete
    //   - Solved vote 3 on obstacle 3 — removed by DB cascade on user delete
    //   - Hike 3 (shared with NaturElskaren) — preserved; only UserId is nulled by EF SetNull
    //   - Hike 4 (not shared) — soft-deleted during deletion flow
    //   - HikeShare recipient record for Hike 5 — removed by DeleteHikeSharesByUserIdAsync

    [Fact]
    public async Task DeleteUser_ShouldReturnNoContent_WhenUserHasReviewsHikesObstaclesAndSharedHikes()
    {
        // Arrange — VandrarVennen has the full set: review, hikes, obstacle, solved vote,
        // one hike shared out, and is a recipient of one shared hike.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteUser_ShouldReturnUnauthorized_WhenUserDoesNotExist()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", NonExistingUser);

        // Act
        var request = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteUser_AfterDeletion_SharedHikeIsStillAccessible()
    {
        // Arrange — VandrarVennen shared Hike 3 with NaturElskaren before deleting.
        // Hike 3 should remain in the database (not soft-deleted) so other users can still read it.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — NaturElskaren fetches the hike that VandrarVennen shared
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var getResponse = await client.GetAsync(
            $"/api/v1/hikes/{SharedHikeIdentifier}",
            TestContext.Current.CancellationToken);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteUser_AfterDeletion_UnsharedHikeIsNotAccessible()
    {
        // Arrange — Hike 4 belongs only to VandrarVennen with no shares.
        // It should be soft-deleted during the deletion flow and no longer accessible.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — NaturElskaren tries to fetch the now-deleted hike
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var getResponse = await client.GetAsync(
            $"/api/v1/hikes/{UnsharedHikeIdentifier}",
            TestContext.Current.CancellationToken);

        // Assert — soft-delete global query filter makes it invisible
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteUser_AfterDeletion_SolvedVoteOnOthersObstacleIsCascadeRemoved()
    {
        // Arrange — Obstacle 3 (on Tångaleden, owned by SkogsGreven) has 3 seeded votes:
        // NaturElskaren, VandrarVennen, and SkogsGreven. VandrarVennen's vote is the one
        // that should cascade away when the user row is deleted.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — fetch obstacles for Tångaleden (no auth required)
        var getResponse = await client.GetAsync(
            $"/api/v1/trailobstacles/trail/{TangaledensTrailIdentifier}",
            TestContext.Current.CancellationToken);

        var obstacles = await getResponse.Content
            .ReadFromJsonAsync<List<TrailObstacleResponse>>(TestContext.Current.CancellationToken);

        var obstacle3 = obstacles!.Single(o => o.Identifier == Obstacle3Identifier);

        // Assert — VandrarVennen's vote is gone; NaturElskaren's and SkogsGreven's remain
        obstacle3.SolvedVotes.Should().HaveCount(2);
        obstacle3.SolvedVotes.Should().NotContain(v => v.UserIdentifier == VandrarVennenIdentifier);
    }

    [Fact]
    public async Task DeleteUser_AfterOwnerDeletion_SharedHikeStillAppearsInRecipientSharedWithMeList()
    {
        // Arrange — VandrarVennen shared Hike 3 with NaturElskaren.
        // After VandrarVennen deletes, the HikeShare row must survive so NaturElskaren
        // still sees Hike 3 via the recipient endpoint (SharedById is nulled by EF SetNull).
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — NaturElskaren fetches their "shared with me" list
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var getResponse = await client.GetAsync(
            "/api/v1/hikesharerecipient",
            TestContext.Current.CancellationToken);

        var sharedHikes = await getResponse.Content.ReadFromJsonAsync<IReadOnlyCollection<HikeShareRecipientResponse>>(
            TestContext.Current.CancellationToken);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        sharedHikes.Should().ContainSingle(h => h.HikeIdentifier == SharedHikeIdentifier);
    }

    [Fact]
    public async Task DeleteUser_AfterRecipientDeletion_HikeShareRecordIsRemoved()
    {
        // Arrange — SkogsGreven shared Hike 5 with VandrarVennen.
        // After VandrarVennen deletes, the HikeShare row where SharedWithId = VandrarVennen
        // must be removed, so SkogsGreven's share count for Hike 5 drops to 0.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — SkogsGreven checks how many users Hike 5 has been shared with
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", SkogsGreven);

        var getResponse = await client.GetAsync(
            $"/api/v1/hikeshares/{SkogsGrevensHike5Identifier}",
            TestContext.Current.CancellationToken);

        var shareCount = await getResponse.Content.ReadFromJsonAsync<int>(
            TestContext.Current.CancellationToken);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        shareCount.Should().Be(0);
    }

    [Fact]
    public async Task DeleteUser_AfterDeletion_OwnedReviewIsCascadeRemoved()
    {
        // Arrange — VandrarVennen owns Review 1 on Tiveden. Reviews cascade at DB level,
        // so Review 1 should disappear when VandrarVennen's user row is deleted.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — fetch reviews for Tiveden (Review 8 by SkogsGreven should remain)
        var getResponse = await client.GetAsync(
            $"/api/v1/reviews/trail/{TivedensTrailIdentifier}?page=1&limit=20",
            TestContext.Current.CancellationToken);

        var paged = await getResponse.Content
            .ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        paged!.Reviews.Should().NotContain(r => r.Identifier == Review1Identifier);
    }

    [Fact]
    public async Task DeleteUser_AfterDeletion_OwnedObstacleIsExplicitlyRemoved()
    {
        // Arrange — VandrarVennen owns Obstacle 2 (Flooding) on Storsjöleden.
        // TrailObstacles use NoAction FK so they must be removed explicitly before user deletion.
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — fetch obstacles for Storsjöleden
        var getResponse = await client.GetAsync(
            $"/api/v1/trailobstacles/trail/{StorsjoledenIdentifier}",
            TestContext.Current.CancellationToken);

        var obstacles = await getResponse.Content
            .ReadFromJsonAsync<List<TrailObstacleResponse>>(TestContext.Current.CancellationToken);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        obstacles.Should().NotContain(o => o.Identifier == Obstacle2Identifier);
    }

    [Fact]
    public async Task DeleteUser_AfterOwnerDeletion_SharedByIsNulledInRecipientResponse()
    {
        // Arrange — VandrarVennen shared Hike 3 with NaturElskaren then deleted.
        // EF SetNull should null HikeShare.SharedById, so SharedByName and SharedByIdentifier
        // in the recipient response must be null (no dangling reference to deleted user).
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithFavorites);

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete");
        await client.SendAsync(deleteRequest, TestContext.Current.CancellationToken);

        // Act — NaturElskaren fetches their "shared with me" list
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", UserWithWishlist);

        var getResponse = await client.GetAsync(
            "/api/v1/hikesharerecipient",
            TestContext.Current.CancellationToken);

        var sharedHikes = await getResponse.Content
            .ReadFromJsonAsync<IReadOnlyCollection<HikeShareRecipientResponse>>(TestContext.Current.CancellationToken);

        var hike3 = sharedHikes!.Single(h => h.HikeIdentifier == SharedHikeIdentifier);

        // Assert
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        hike3.SharedByName.Should().BeNull();
        hike3.SharedByIdentifier.Should().BeNull();
    }
}
