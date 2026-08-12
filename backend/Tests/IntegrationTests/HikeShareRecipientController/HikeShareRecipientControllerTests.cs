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
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string NaturElskarenNickName = "NaturElskaren";
    private const string VandrarVennenNickName = "VandrarVennen";
    private const string SkogsGrevNickName = "SkogsGreven";

    // Seed state:
    //   Hike3 (91e4c2d7-...) → NaturElskaren: Accepted, AllowResharing = true   (VandrarVennen is sharer)
    //   Hike5 (7a1e9c3d-...) → VandrarVennen: Accepted, AllowResharing = false  (SkogsGreven is sharer)
    // Pending shares are created on-demand via CreatePendingHike4ShareAsync.
    private const string Hike1Identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90"; // NaturElskaren's hike
    private const string Hike3Identifier = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13"; // Accepted for NaturElskaren, resharing allowed
    private const string Hike4Identifier = "c4d8a1b9-6f3e-4c72-8a5d-1e9b2f7c0a46"; // VandrarVennen's, used for Pending
    private const string Hike5Identifier = "7a1e9c3d-2b4f-4d68-8c0a-5f2b7e1d9c32"; // Accepted for VandrarVennen, resharing NOT allowed

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
    private Task EstablishFriendshipWithNaturElskaren(string targetUid, string targetNickName) =>
        EstablishFriendship(NaturElskarenUid, NaturElskarenIdentifier, targetUid, targetNickName);

    // The requester sends a friend request to the target user, who then accepts it.
    private async Task EstablishFriendship(string requesterUid, string requesterIdentifier, string targetUid, string targetNickName)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", requesterUid);
        await client.PostAsJsonAsync($"{FRIENDS_URL}/requests",
            new SendFriendRequestRequest { ReceiverNickName = targetNickName },
            TestContext.Current.CancellationToken);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", targetUid);
        await client.PutAsync($"{FRIENDS_URL}/requests/accept/{requesterIdentifier}", null, TestContext.Current.CancellationToken);
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

    [Fact]
    public async Task GetSharedHikes_ReportsWhetherTheOwnerAllowedResharing()
    {
        // Arrange — Hike3 is seeded with resharing allowed, Hike5 without it. The app hides
        // the reshare button on this flag, so it has to survive the trip to the client.
        var naturElskaren = CreateAuthenticatedClient(NaturElskarenUid);
        var vandrarVennen = CreateAuthenticatedClient(VandrarVennenUid);

        // Act
        var allowed = await (await naturElskaren.GetAsync(BASE_URL, TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<HikeShareRecipientResponse>>(TestContext.Current.CancellationToken);
        var notAllowed = await (await vandrarVennen.GetAsync(BASE_URL, TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<HikeShareRecipientResponse>>(TestContext.Current.CancellationToken);

        // Assert
        allowed.Should().ContainSingle(h => h.HikeIdentifier == Hike3Identifier)
            .Which.AllowResharing.Should().BeTrue();
        notAllowed.Should().ContainSingle(h => h.HikeIdentifier == Hike5Identifier)
            .Which.AllowResharing.Should().BeFalse();
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
        // Arrange — NaturElskaren already has Hike3 as Accepted in seed, with the owner's
        // permission to reshare it
        await EstablishFriendshipWithNaturElskaren(SkogsGrevUid, SkogsGrevNickName);
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = SkogsGrevNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ReshareSharedHike_WhenOwnerDidNotAllowResharing_ReturnsForbidden()
    {
        // Arrange — VandrarVennen has Hike5 as Accepted, but SkogsGreven (the owner) never
        // opted in. The friendship is established so the 403 can only come from the flag.
        await EstablishFriendshipWithNaturElskaren(VandrarVennenUid, VandrarVennenNickName);
        var client = CreateAuthenticatedClient(VandrarVennenUid);
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike5Identifier, ReShareToName = NaturElskarenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ReshareSharedHike_WhenReshared_TheNewRecipientCannotReshareAgain()
    {
        // Arrange — the chain has to end one hop past the owner. NaturElskaren reshares
        // Hike3 to SkogsGreven, who accepts it and then tries to pass it back to
        // NaturElskaren. The two are friends and NaturElskaren already holds the hike, so
        // without the flag check this would answer 409 — the 403 can only be the flag.
        await EstablishFriendshipWithNaturElskaren(SkogsGrevUid, SkogsGrevNickName);
        var naturElskaren = CreateAuthenticatedClient(NaturElskarenUid);
        await naturElskaren.PostAsJsonAsync($"{BASE_URL}/re-share",
            new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = SkogsGrevNickName },
            TestContext.Current.CancellationToken);

        var skogsGreven = CreateAuthenticatedClient(SkogsGrevUid);
        await skogsGreven.PutAsync($"{BASE_URL}/accept/{Hike3Identifier}", null, TestContext.Current.CancellationToken);

        // Act — the reshare attempt, and what the app is told about the button
        var response = await skogsGreven.PostAsJsonAsync($"{BASE_URL}/re-share",
            new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = NaturElskarenNickName },
            TestContext.Current.CancellationToken);

        var shares = await (await skogsGreven.GetAsync(BASE_URL, TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<HikeShareRecipientResponse>>(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        shares.Should().ContainSingle(h => h.HikeIdentifier == Hike3Identifier)
            .Which.AllowResharing.Should().BeFalse();
    }

    [Fact]
    public async Task ReshareSharedHike_WhenTargetHasAnUnansweredShareFromTheOwner_ReturnsConflict()
    {
        // Arrange — the owner VandrarVennen shared Hike3 with both NaturElskaren (accepted
        // in seed, resharing allowed) and SkogsGreven, who has not answered yet. The row
        // (Hike3, SkogsGreven) therefore already exists as Pending, owned by the owner's
        // own decision about resharing.
        await EstablishFriendship(VandrarVennenUid, VandrarVennenIdentifier, SkogsGrevUid, SkogsGrevNickName);
        var owner = CreateAuthenticatedClient(VandrarVennenUid);
        await owner.PostAsJsonAsync($"{HIKESHARES_URL}/share",
            new HikeShareRequest { HikeIdentifier = Hike3Identifier, SharedWithName = SkogsGrevNickName, AllowResharing = true },
            TestContext.Current.CancellationToken);

        await EstablishFriendshipWithNaturElskaren(SkogsGrevUid, SkogsGrevNickName);
        var naturElskaren = CreateAuthenticatedClient(NaturElskarenUid);

        // Act — NaturElskaren, who may reshare, offers it to SkogsGreven as well
        var response = await naturElskaren.PostAsJsonAsync($"{BASE_URL}/re-share",
            new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = SkogsGrevNickName },
            TestContext.Current.CancellationToken);

        // Assert — HikeShare is keyed on (HikeId, SharedWithId), so a pending share has to
        // count as "already shared". Narrow the duplicate check to Accepted and the reshare
        // collides with the primary key: a 500 instead of a conflict, and had it succeeded
        // it would have replaced the owner's own terms with the resharer's.
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task ReshareSharedHike_WhenTargetHasAnUnansweredReshare_ReturnsConflict()
    {
        // Arrange — same collision from the other direction: the pending row was created by
        // a reshare rather than by the owner
        await EstablishFriendshipWithNaturElskaren(SkogsGrevUid, SkogsGrevNickName);
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        var request = new ReshareSharedHikeRequest { HikeIdentifier = Hike3Identifier, ReShareToName = SkogsGrevNickName };
        await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Act — offering it again must not try to insert a second row
        var response = await client.PostAsJsonAsync($"{BASE_URL}/re-share", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
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
