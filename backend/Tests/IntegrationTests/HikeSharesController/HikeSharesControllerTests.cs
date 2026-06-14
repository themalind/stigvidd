using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Friend;
using WebDataContracts.RequestModels.HikeShare;

namespace IntegrationTests.HikeSharesController;

public class HikeSharesControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string BASE_URL = "/api/v1/hikeshares";
    private const string FRIENDS_URL = "/api/v1/friends";

    // Users
    private const string NaturElskarenUid = "firebase-uid-12345";  // User1, owns Hike1 & Hike2
    private const string VandrarVennenUid = "firebase-uid-12346";  // User2, owns Hike3 & Hike4
    private const string UnknownUserUid = "not-a-valid-uid";

    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string NaturElskarenNickName = "NaturElskaren";
    private const string VandrarVennenNickName = "VandrarVennen";

    // Hikes
    private const string Hike1Identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90"; // NaturElskaren's
    private const string Hike3Identifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13"; // VandrarVennen's

    public HikeSharesControllerTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    #region GET /{hikeIdentifier}

    [Fact]
    public async Task GetHikeShareCount_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"{BASE_URL}/{Hike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetHikeShareCount_WhenUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", UnknownUserUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/{Hike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetHikeShareCount_ForOwnHike_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/{Hike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHikeShareCount_ForUnsharedHike_ReturnsZero()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);

        // Act
        var count = await client.GetFromJsonAsync<int>($"{BASE_URL}/{Hike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        count.Should().Be(0);
    }

    [Fact]
    public async Task GetHikeShareCount_ForSharedHike_ReturnsNonZeroCount()
    {
        // Arrange — Hike3 (VandrarVennen's) has 1 seeded share
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", VandrarVennenUid);

        // Act
        var count = await client.GetFromJsonAsync<int>($"{BASE_URL}/{Hike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        count.Should().Be(1);
    }

    #endregion

    #region POST /share

    [Fact]
    public async Task ShareHike_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new HikeShareRequest { HikeIdentifier = Hike1Identifier, SharedWithName = VandrarVennenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ShareHike_WhenUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", UnknownUserUid);
        var request = new HikeShareRequest { HikeIdentifier = Hike1Identifier, SharedWithName = VandrarVennenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ShareHike_WithNonExistentUser_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);
        var request = new HikeShareRequest { HikeIdentifier = Hike1Identifier, SharedWithName = "NoSuchUser" };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ShareHike_WithNonFriend_ReturnsForbidden()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);
        var request = new HikeShareRequest { HikeIdentifier = Hike1Identifier, SharedWithName = VandrarVennenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ShareHike_WhenNotOwnerOfHike_ReturnsForbidden()
    {
        // Arrange — establish friendship so the ownership check is reached
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);
        await client.PostAsJsonAsync($"{FRIENDS_URL}/requests",
            new SendFriendRequestRequest { ReceiverNickName = VandrarVennenNickName },
            TestContext.Current.CancellationToken);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", VandrarVennenUid);
        await client.PutAsync($"{FRIENDS_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);

        // Act — VandrarVennen tries to share NaturElskaren's Hike1 with NaturElskaren
        var request = new HikeShareRequest { HikeIdentifier = Hike1Identifier, SharedWithName = NaturElskarenNickName };
        var response = await client.PostAsJsonAsync($"{BASE_URL}/share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ShareHike_WithFriend_ReturnsOk()
    {
        // Arrange — NaturElskaren sends request, VandrarVennen accepts
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);
        await client.PostAsJsonAsync($"{FRIENDS_URL}/requests",
            new SendFriendRequestRequest { ReceiverNickName = VandrarVennenNickName },
            TestContext.Current.CancellationToken);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", VandrarVennenUid);
        await client.PutAsync($"{FRIENDS_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);

        // Act — NaturElskaren shares Hike1 with VandrarVennen
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);
        var request = new HikeShareRequest { HikeIdentifier = Hike1Identifier, SharedWithName = VandrarVennenNickName };
        var response = await client.PostAsJsonAsync($"{BASE_URL}/share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion
}
