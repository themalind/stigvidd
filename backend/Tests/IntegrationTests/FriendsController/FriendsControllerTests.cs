// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Friend;
using WebDataContracts.ResponseModels.Friend;

namespace IntegrationTests.FriendsController;

public class FriendsControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    private const string BASE_URL = "/api/v1/friends";
    private const string AuthenticatedUser = "firebase-uid-12346";    // User 2: VandrarVennen
    private const string OtherAuthenticatedUser = "firebase-uid-12345"; // User 1: NaturElskaren
    private const string NotAuthenticatedUser = "not-a-valid-uid";

    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string VandrarVennenNickName = "VandrarVennen";
    private const string NaturElskarenNickName = "NaturElskaren";
    #endregion

    public FriendsControllerTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    #region GetFriends

    [Fact]
    public async Task GetFriends_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetFriends_Authenticated_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetFriends_WithUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NotAuthenticatedUser);

        // Act
        var response = await client.GetAsync(BASE_URL, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region GetIncomingFriendRequests

    [Fact]
    public async Task GetIncomingFriendRequests_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"{BASE_URL}/requests/incoming", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetIncomingFriendRequests_Authenticated_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/requests/incoming", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetIncomingFriendRequests_WithUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NotAuthenticatedUser);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/requests/incoming", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region GetOutgoingFriendRequests

    [Fact]
    public async Task GetOutgoingFriendRequests_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync($"{BASE_URL}/requests/outgoing", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetOutgoingFriendRequests_Authenticated_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/requests/outgoing", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetOutgoingFriendRequests_WithUnknownUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", NotAuthenticatedUser);

        // Act
        var response = await client.GetAsync($"{BASE_URL}/requests/outgoing", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region SendFriendRequest

    [Fact]
    public async Task SendFriendRequest_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var request = new SendFriendRequestRequest { ReceiverNickName = NaturElskarenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SendFriendRequest_ToExistingUser_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new SendFriendRequestRequest { ReceiverNickName = NaturElskarenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SendFriendRequest_ToNonExistentUser_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new SendFriendRequestRequest { ReceiverNickName = "MiddleEarthUser" };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SendFriendRequest_ToSelf_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new SendFriendRequestRequest { ReceiverNickName = VandrarVennenNickName };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SendFriendRequest_WithEmptyNickName_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new SendFriendRequestRequest { ReceiverNickName = string.Empty };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SendFriendRequest_WithNickNameExceeding20Characters_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new SendFriendRequestRequest { ReceiverNickName = new string('a', 21) };

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SendFriendRequest_WhenRequestAlreadyExists_ReturnsConflict()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var request = new SendFriendRequestRequest { ReceiverNickName = NaturElskarenNickName };
        await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Act
        var response = await client.PostAsJsonAsync($"{BASE_URL}/requests", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    #endregion

    #region AcceptFriendRequest

    [Fact]
    public async Task AcceptFriendRequest_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.PutAsync($"{BASE_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AcceptFriendRequest_WhenNoPendingRequest_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.PutAsync($"{BASE_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AcceptFriendRequest_WhenRequestExists_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", OtherAuthenticatedUser);
        var sendRequest = new SendFriendRequestRequest { ReceiverNickName = VandrarVennenNickName };
        await client.PostAsJsonAsync($"{BASE_URL}/requests", sendRequest, TestContext.Current.CancellationToken);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.PutAsync($"{BASE_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region RejectConnection

    [Fact]
    public async Task RejectConnection_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/reject/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RejectConnection_WhenNoConnectionExists_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/reject/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RejectConnection_WhenPendingRequestExists_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var sendRequest = new SendFriendRequestRequest { ReceiverNickName = NaturElskarenNickName };
        await client.PostAsJsonAsync($"{BASE_URL}/requests", sendRequest, TestContext.Current.CancellationToken);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/reject/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region RemoveFriend

    [Fact]
    public async Task RemoveFriend_Unauthenticated_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RemoveFriend_WhenNotFriends_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveFriend_WhenFriendshipExists_ReturnsOk()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", OtherAuthenticatedUser);
        var sendRequest = new SendFriendRequestRequest { ReceiverNickName = VandrarVennenNickName };
        await client.PostAsJsonAsync($"{BASE_URL}/requests", sendRequest, TestContext.Current.CancellationToken);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        await client.PutAsync($"{BASE_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken);

        // Act
        var response = await client.DeleteAsync($"{BASE_URL}/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region SetFriendNote

    private HttpClient ClientFor(string user)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", user);
        return client;
    }

    private async Task MakeVandrarVennenAndNaturElskarenFriendsAsync()
    {
        var sendRequest = new SendFriendRequestRequest { ReceiverNickName = VandrarVennenNickName };
        (await ClientFor(OtherAuthenticatedUser).PostAsJsonAsync($"{BASE_URL}/requests", sendRequest, TestContext.Current.CancellationToken))
            .EnsureSuccessStatusCode();
        (await ClientFor(AuthenticatedUser).PutAsync($"{BASE_URL}/requests/accept/{NaturElskarenIdentifier}", null, TestContext.Current.CancellationToken))
            .EnsureSuccessStatusCode();
    }

    private static async Task<FriendResponse> FriendNamedAsync(HttpClient client, string nickName)
    {
        var friends = await client.GetFromJsonAsync<List<FriendResponse>>(BASE_URL, TestContext.Current.CancellationToken);
        friends.Should().NotBeNull();
        return (friends ?? []).Single(f => f.NickName == nickName);
    }

    private static Task<HttpResponseMessage> PutNoteAsync(HttpClient client, string friendIdentifier, string? note) =>
        client.PutAsJsonAsync($"{BASE_URL}/{friendIdentifier}/note", new SetFriendNoteRequest { Note = note }, TestContext.Current.CancellationToken);

    [Fact]
    public async Task SetFriendNote_Unauthenticated_ReturnsUnauthorized()
    {
        var response = await PutNoteAsync(_factory.CreateClient(), NaturElskarenIdentifier, "x");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SetFriendNote_ShowsOnlyInTheWritersFriendList()
    {
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();
        var writer = ClientFor(AuthenticatedUser);

        var response = await PutNoteAsync(writer, NaturElskarenIdentifier, "  Kusin Natalie  ");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FriendNamedAsync(writer, NaturElskarenNickName)).Note.Should().Be("Kusin Natalie");
        (await FriendNamedAsync(ClientFor(OtherAuthenticatedUser), VandrarVennenNickName)).Note.Should().BeNull();
    }

    [Fact]
    public async Task SetFriendNote_Blank_RemovesTheNote()
    {
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();
        var writer = ClientFor(AuthenticatedUser);
        await PutNoteAsync(writer, NaturElskarenIdentifier, "Kusin");

        var response = await PutNoteAsync(writer, NaturElskarenIdentifier, "   ");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await FriendNamedAsync(writer, NaturElskarenNickName)).Note.Should().BeNull();
    }

    [Fact]
    public async Task SetFriendNote_OnSomeoneWhoIsNotAFriend_ReturnsNotFound()
    {
        var response = await PutNoteAsync(ClientFor(AuthenticatedUser), NaturElskarenIdentifier, "Kusin");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetFriendNote_TooLong_ReturnsBadRequest()
    {
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();

        var response = await PutNoteAsync(ClientFor(AuthenticatedUser), NaturElskarenIdentifier, new string('a', 61));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RemoveFriend_ForgetsTheNote()
    {
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();
        var writer = ClientFor(AuthenticatedUser);
        await PutNoteAsync(writer, NaturElskarenIdentifier, "Kusin");

        (await writer.DeleteAsync($"{BASE_URL}/{NaturElskarenIdentifier}", TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();

        (await FriendNamedAsync(writer, NaturElskarenNickName)).Note.Should().BeNull();
    }

    #endregion

    #region GetFriendProfile

    [Fact]
    public async Task GetFriends_SaysSinceWhenEachFriendshipLasts()
    {
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();

        var friend = await FriendNamedAsync(ClientFor(AuthenticatedUser), NaturElskarenNickName);

        friend.FriendsSince.Should().NotBeNull();
        friend.FriendsSince.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(5));
    }

    [Fact]
    public async Task GetFriendProfile_Unauthenticated_ReturnsUnauthorized()
    {
        var response = await _factory.CreateClient().GetAsync($"{BASE_URL}/{NaturElskarenIdentifier}/profile", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetFriendProfile_OfSomeoneWhoIsNotAFriend_ReturnsNotFound()
    {
        var response = await ClientFor(AuthenticatedUser).GetAsync($"{BASE_URL}/{NaturElskarenIdentifier}/profile", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetFriendProfile_OfAFriend_ListsTheirReviews()
    {
        await MakeVandrarVennenAndNaturElskarenFriendsAsync();

        var profile = await ClientFor(AuthenticatedUser).GetFromJsonAsync<FriendProfileResponse>(
            $"{BASE_URL}/{NaturElskarenIdentifier}/profile", TestContext.Current.CancellationToken);

        profile.Should().NotBeNull();
        if (profile is null) return;
        profile.Reviews.Select(r => r.Identifier).Should().Contain("r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
        profile.Reviews.Select(r => r.TrailName).Should().NotContain("");
    }

    #endregion
}
