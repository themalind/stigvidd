using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Friend;
using WebDataContracts.RequestModels.HikeShare;
using WebDataContracts.ResponseModels.HikeShare;

namespace IntegrationTests.HikeShareRecipientController;

public class HikeShareRecipientControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string BASE_URL = "/api/v1/hikesharerecipient";
    private const string FRIENDS_URL = "/api/v1/friends";
    private const string HIKESHARES_URL = "/api/v1/hikeshares";

    // Users
    private const string NaturElskarenUid = "firebase-uid-12345";  // User1
    private const string VandrarVennenUid = "firebase-uid-12346";  // User2
    private const string SkogsGrevUid = "firebase-uid-12347";      // User3 — no shares in seed
    private const string UnknownUserUid = "not-a-valid-uid";

    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string NaturElskarenNickName = "NaturElskaren";
    private const string VandrarVennenNickName = "VandrarVennen";
    private const string SkogsGrevNickName = "SkogsGreven";

    // Seed state:
    //   Hike3 (91e4c2d7-...) → NaturElskaren: Accepted  (VandrarVennen is sharer)
    //   Hike5 (7a1e9c3d-...) → VandrarVennen: Accepted  (SkogsGreven is sharer)
    // Pending shares are created on-demand via CreatePendingHike4ShareAsync.
    private const string Hike1Identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90"; // NaturElskaren's hike
    private const string Hike3Identifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13"; // Accepted for NaturElskaren
    private const string Hike4Identifier = "c4d8a1b9-6f3e-4c72-8a5d-1e9b2f7c0a46"; // VandrarVennen's, used for Pending

    public HikeShareRecipientControllerTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient CreateAuthenticatedClient(string subjectId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subjectId);
        return client;
    }

    // NaturElskaren sends a friend request to the target user, who then accepts it.
    private async Task EstablishFriendshipWithNaturElskaren(string targetUid, string targetNickName)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NaturElskarenUid);
        await client.PostAsJsonAsync($"{FRIENDS_URL}/requests",
            new SendFriendRequestRequest { ReceiverNickName = targetNickName },
            TestContext.Current.CancellationToken);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", targetUid);
        await client.PutAsync($"{FRIENDS_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);
    }

    // Creates a Pending share of Hike4 (owned by VandrarVennen) for NaturElskaren via the share API.
    // Also establishes the NaturElskaren–VandrarVennen friendship that is a prerequisite.
    private async Task CreatePendingHike4ShareAsync()
    {
        await EstablishFriendshipWithNaturElskaren(VandrarVennenUid, VandrarVennenNickName);
        var client = CreateAuthenticatedClient(VandrarVennenUid);
        await client.PostAsJsonAsync($"{HIKESHARES_URL}/share",
            new HikeShareRequest { HikeIdentifier = Hike4Identifier, SharedWithName = NaturElskarenNickName },
            TestContext.Current.CancellationToken);
    }

    #region GET / — accepted shares

    [Fact]
    public async Task GetSharedHikes_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSharedHikes_WhenUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = CreateAuthenticatedClient(UnknownUserUid);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSharedHikes_WhenNoAcceptedShares_ReturnsOkWithEmptyList()
    {
        // Arrange — SkogsGreven has no accepted shares in seed data
        var client = CreateAuthenticatedClient(SkogsGrevUid);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);
        var shares = await response.Content.ReadFromJsonAsync<List<HikeShareRecipientResponse>>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        shares.Should().BeEmpty();
    }

    [Fact]
    public async Task GetSharedHikes_WhenAcceptedShareExists_ReturnsOkWithShares()
    {
        // Arrange — Hike3 is seeded as Accepted for NaturElskaren
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);
        var shares = await response.Content.ReadFromJsonAsync<List<HikeShareRecipientResponse>>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        shares.Should().Contain(h => h.HikeIdentifier == Hike3Identifier);
    }

    #endregion

    #region GET /incoming — pending shares

    [Fact]
    public async Task GetIncomingShares_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomingShares_WhenUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = CreateAuthenticatedClient(UnknownUserUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomingShares_WhenPendingShareExists_ReturnsOkWithShares()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming", TestContext.Current.CancellationToken);
        var shares = await response.Content.ReadFromJsonAsync<List<IncomingHikeShareResponse>>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        shares.Should().ContainSingle(h => h.HikeIdentifier == Hike4Identifier);
    }

    [Fact]
    public async Task GetIncomingShares_WhenNoPendingShares_ReturnsOkWithEmptyList()
    {
        // Arrange — SkogsGreven has no pending incoming shares in seed data
        var client = CreateAuthenticatedClient(SkogsGrevUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming", TestContext.Current.CancellationToken);
        var shares = await response.Content.ReadFromJsonAsync<List<IncomingHikeShareResponse>>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        shares.Should().BeEmpty();
    }

    #endregion

    #region GET /incoming/{hikeIdentifier}

    [Fact]
    public async Task GetIncomingShare_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming/{Hike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomingShare_WhenPendingShareExists_ReturnsOk()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming/{Hike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetIncomingShare_WhenPendingShareExists_ReturnsShareDetails()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var share = await client.GetFromJsonAsync<HikeShareRecipientResponse>(
            $"{BASE_URL}/incoming/{Hike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        share!.HikeIdentifier.Should().Be(Hike4Identifier);
    }

    [Fact]
    public async Task GetIncomingShare_WhenShareNotFound_ReturnsNotFound()
    {
        // Arrange — Hike3 is Accepted (not Pending) for NaturElskaren
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/incoming/{Hike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region PUT /accept/{hikeIdentifier}

    [Fact]
    public async Task AcceptSharedHike_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsync($"{BASE_URL}/accept/{Hike4Identifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AcceptSharedHike_WhenPendingShareExists_ReturnsOk()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.PutAsync($"{BASE_URL}/accept/{Hike4Identifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AcceptSharedHike_WhenPendingShareExists_MakesShareVisible()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        await client.PutAsync($"{BASE_URL}/accept/{Hike4Identifier}", null, TestContext.Current.CancellationToken);

        // Assert
        var shares = await client.GetFromJsonAsync<List<HikeShareRecipientResponse>>(BASE_URL, TestContext.Current.CancellationToken);
        shares.Should().Contain(h => h.HikeIdentifier == Hike4Identifier);
    }

    [Fact]
    public async Task AcceptSharedHike_WhenNoPendingShare_ReturnsNotFound()
    {
        // Arrange — VandrarVennen has no pending share for Hike1
        var client = CreateAuthenticatedClient(VandrarVennenUid);

        // Act
        var response = await client.PutAsync($"{BASE_URL}/accept/{Hike1Identifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region DELETE /reject/{hikeIdentifier}

    [Fact]
    public async Task RejectSharedHike_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/reject/{Hike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RejectSharedHike_WhenPendingShareExists_ReturnsOk()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/reject/{Hike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RejectSharedHike_WhenPendingShareExists_RemovesShareFromIncoming()
    {
        // Arrange
        await CreatePendingHike4ShareAsync();
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        await client.DeleteAsync($"{BASE_URL}/reject/{Hike4Identifier}", TestContext.Current.CancellationToken);

        // Assert
        var incoming = await client.GetFromJsonAsync<List<IncomingHikeShareResponse>>(
            $"{BASE_URL}/incoming", TestContext.Current.CancellationToken);
        incoming.Should().NotContain(h => h.HikeIdentifier == Hike4Identifier);
    }

    [Fact]
    public async Task RejectSharedHike_WhenNoPendingShare_ReturnsNotFound()
    {
        // Arrange — VandrarVennen has no pending share for Hike1
        var client = CreateAuthenticatedClient(VandrarVennenUid);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/reject/{Hike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region DELETE /{hikeIdentifier} — remove accepted share

    [Fact]
    public async Task RemoveSharedHike_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/{Hike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RemoveSharedHike_WhenAcceptedShareExists_ReturnsOk()
    {
        // Arrange — Hike3 is seeded as Accepted for NaturElskaren
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/{Hike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RemoveSharedHike_WhenAcceptedShareExists_RemovesShareFromList()
    {
        // Arrange
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        await client.DeleteAsync($"{BASE_URL}/{Hike3Identifier}", TestContext.Current.CancellationToken);

        // Assert
        var shares = await client.GetFromJsonAsync<List<HikeShareRecipientResponse>>(BASE_URL, TestContext.Current.CancellationToken);
        shares.Should().NotContain(h => h.HikeIdentifier == Hike3Identifier);
    }

    [Fact]
    public async Task RemoveSharedHike_WhenNoShareExists_ReturnsOk()
    {
        // Arrange — DeleteHikeShareAsync is idempotent
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/{Hike1Identifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region POST /re-share

    [Fact]
    public async Task ReshareSharedHike_WhenUnauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = SkogsGrevNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ReshareSharedHike_WhenNoAcceptedShare_ReturnsForbidden()
    {
        // Arrange — Hike4 is not an accepted share for NaturElskaren
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike4Identifier, ReShareToName = SkogsGrevNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ReshareSharedHike_WithAcceptedShareAndFriend_ReturnsOk()
    {
        // Arrange — NaturElskaren already has Hike3 as Accepted in seed
        await EstablishFriendshipWithNaturElskaren(SkogsGrevUid, SkogsGrevNickName);
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = SkogsGrevNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ReshareSharedHike_WhenTargetIsOwner_ReturnsBadRequest()
    {
        // Arrange — Hike3 is owned by VandrarVennen; resharing back to the owner returns 400
        await EstablishFriendshipWithNaturElskaren(VandrarVennenUid, VandrarVennenNickName);
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = VandrarVennenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion
}
