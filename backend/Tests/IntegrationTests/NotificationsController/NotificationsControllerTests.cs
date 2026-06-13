using FluentAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.PushToken;

namespace IntegrationTests.NotificationsController;

public class NotificationsControllerTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string BASE_URL = "/api/v1/notifications";
    private const string NaturElskarenUid = "firebase-uid-12345"; // User 1
    private const string VandrarVennenUid = "firebase-uid-12346"; // User 2
    private const string UnknownUserUid = "firebase-uid-99999";   // Not in DB
    private const string TestToken = "test-expo-push-token";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public NotificationsControllerTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient CreateAuthenticatedClient(string firebaseUid)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", firebaseUid);
        return client;
    }

    private static RegisterPushTokenRequest ValidRequest(string token = TestToken, string platform = "ios") => new()
    {
        ExpoToken = token,
        Platform = platform
    };

    #region POST /tokens

    [Fact]
    public async Task RegisterToken_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RegisterToken_WhenUnknownUser_ReturnsUnauthorized()
    {
        var client = CreateAuthenticatedClient(UnknownUserUid);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RegisterToken_WithInvalidPlatform_ReturnsBadRequest()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(platform: "web"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RegisterToken_WithEmptyExpoToken_ReturnsBadRequest()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(token: ""), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RegisterToken_WithValidIosToken_ReturnsOk()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(platform: "ios"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RegisterToken_WithValidAndroidToken_ReturnsOk()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(platform: "android"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RegisterToken_WhenSameTokenRegisteredTwice_ReturnsOkBothTimes()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RegisterToken_WhenSameTokenUpdatedToDifferentPlatform_ReturnsOk()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(platform: "ios"), TestContext.Current.CancellationToken);

        var response = await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(platform: "android"), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    #endregion

    #region DELETE /tokens/{expoToken}

    [Fact]
    public async Task DeleteToken_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync($"{BASE_URL}/tokens/{TestToken}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteToken_WhenUnknownUser_ReturnsUnauthorized()
    {
        var client = CreateAuthenticatedClient(UnknownUserUid);

        var response = await client.DeleteAsync($"{BASE_URL}/tokens/{TestToken}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteToken_WhenTokenDoesNotExist_ReturnsNotFound()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);

        var response = await client.DeleteAsync($"{BASE_URL}/tokens/nonexistent-token", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteToken_WhenTokenExists_ReturnsOk()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);

        var response = await client.DeleteAsync($"{BASE_URL}/tokens/{TestToken}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteToken_WhenTokenDeletedTwice_ReturnsNotFoundOnSecondDelete()
    {
        var client = CreateAuthenticatedClient(NaturElskarenUid);
        await client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);
        await client.DeleteAsync($"{BASE_URL}/tokens/{TestToken}", TestContext.Current.CancellationToken);

        var response = await client.DeleteAsync($"{BASE_URL}/tokens/{TestToken}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteToken_WhenTokenBelongsToAnotherUser_ReturnsNotFound()
    {
        var user1Client = CreateAuthenticatedClient(NaturElskarenUid);
        await user1Client.PostAsJsonAsync($"{BASE_URL}/tokens", ValidRequest(), TestContext.Current.CancellationToken);

        var user2Client = CreateAuthenticatedClient(VandrarVennenUid);
        var response = await user2Client.DeleteAsync($"{BASE_URL}/tokens/{TestToken}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion
}
