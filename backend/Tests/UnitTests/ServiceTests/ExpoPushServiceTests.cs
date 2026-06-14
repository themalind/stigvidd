using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Net;
using System.Text;

namespace UnitTests.ServiceTests;

public class ExpoPushServiceTests
{
    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _statusCode;
        private readonly string _jsonBody;

        public FakeHttpMessageHandler(HttpStatusCode statusCode = HttpStatusCode.OK, string jsonBody = """{"data": []}""")
        {
            _statusCode = statusCode;
            _jsonBody = jsonBody;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(_statusCode)
            {
                Content = new StringContent(_jsonBody, Encoding.UTF8, "application/json")
            });
    }

    private static HttpClient CreateHttpClient(HttpStatusCode statusCode = HttpStatusCode.OK, string jsonBody = """{"data": []}""")
        => new(new FakeHttpMessageHandler(statusCode, jsonBody)) { BaseAddress = new Uri("https://exp.host/") };

    private static ExpoPushService Build(
        Mock<IUserPushTokenRepository>? tokenRepoMock = null,
        Mock<IUserRepository>? userRepoMock = null,
        HttpClient? httpClient = null,
        Mock<IConfiguration>? configMock = null)
    {
        var defaultConfig = new Mock<IConfiguration>();
        defaultConfig.Setup(c => c[It.IsAny<string>()]).Returns((string?)null);

        return new ExpoPushService(
            tokenRepoMock?.Object ?? new Mock<IUserPushTokenRepository>().Object,
            userRepoMock?.Object ?? new Mock<IUserRepository>().Object,
            httpClient ?? CreateHttpClient(),
            configMock?.Object ?? defaultConfig.Object,
            new Mock<ILogger<ExpoPushService>>().Object
        );
    }

    private static IEnumerable<UserPushToken> SingleToken(string token = "ExponentPushToken[test]") =>
        [new UserPushToken { UserId = 1, ExpoToken = token, Platform = "ios" }];

    // RegisterTokenAsync

    [Fact]
    public async Task RegisterTokenAsync_WhenUserNotFound_Returns404()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepoMock: userRepoMock);

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenUserRepoErrors_Returns500()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepoMock: userRepoMock);

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenUpsertFails_Returns500()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.UpsertAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RegisterTokenAsync_WhenSuccessful_ReturnsOk()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.UpsertAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    // UnregisterTokenAsync

    [Fact]
    public async Task UnregisterTokenAsync_WhenUserNotFound_Returns404()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepoMock: userRepoMock);

        var result = await service.UnregisterTokenAsync("identifier", "token", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UnregisterTokenAsync_WhenUserRepoErrors_Returns500()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepoMock: userRepoMock);

        var result = await service.UnregisterTokenAsync("identifier", "token", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UnregisterTokenAsync_WhenGetTokenErrors_Returns500()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetByTokenAndUserAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserPushToken?>.Error());

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.UnregisterTokenAsync("identifier", "token", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UnregisterTokenAsync_WhenTokenNotFoundForUser_Returns404()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetByTokenAndUserAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserPushToken?>.Success(null));

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.UnregisterTokenAsync("identifier", "token", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UnregisterTokenAsync_WhenDeleteFails_Returns500()
    {
        var existingToken = new UserPushToken { UserId = 1, ExpoToken = "token", Platform = "ios" };

        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetByTokenAndUserAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserPushToken?>.Success(existingToken));
        tokenRepoMock.Setup(r => r.DeleteByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.UnregisterTokenAsync("identifier", "token", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UnregisterTokenAsync_WhenSuccessful_ReturnsOk()
    {
        var existingToken = new UserPushToken { UserId = 1, ExpoToken = "token", Platform = "ios" };

        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetByTokenAndUserAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UserPushToken?>.Success(existingToken));
        tokenRepoMock.Setup(r => r.DeleteByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.UnregisterTokenAsync("identifier", "token", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    // SendToUserAsync

    [Fact]
    public async Task SendToUserAsync_WhenUserNotFound_Returns404()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepoMock: userRepoMock);

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task SendToUserAsync_WhenUserRepoErrors_Returns500()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepoMock: userRepoMock);

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendToUserAsync_WhenGetTokensErrors_Returns500()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Error());

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendToUserAsync_WhenUserHasNoTokens_ReturnsOk()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Success([]));

        var service = Build(tokenRepoMock: tokenRepoMock, userRepoMock: Utilities.MockFactory.UserRepositoryFoundById());

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task SendToUserAsync_WhenHttpCallFails_StillReturnsOk()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Success(SingleToken()));

        var service = Build(
            tokenRepoMock: tokenRepoMock,
            userRepoMock: Utilities.MockFactory.UserRepositoryFoundById(),
            httpClient: CreateHttpClient(HttpStatusCode.InternalServerError));

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task SendToUserAsync_WhenAllTicketsOk_DoesNotDeleteAnyToken()
    {
        const string token = "ExponentPushToken[test]";
        const string okJson = """{"data": [{"status": "ok", "id": "abc", "message": null, "details": null}]}""";

        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Success(SingleToken(token)));

        var service = Build(
            tokenRepoMock: tokenRepoMock,
            userRepoMock: Utilities.MockFactory.UserRepositoryFoundById(),
            httpClient: CreateHttpClient(HttpStatusCode.OK, okJson));

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.DeleteByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendToUserAsync_WhenDeviceNotRegisteredTicket_DeletesStalToken()
    {
        const string token = "ExponentPushToken[stale]";
        const string staleJson = """{"data": [{"status": "error", "id": null, "message": "Not registered", "details": {"error": "DeviceNotRegistered"}}]}""";

        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Success(SingleToken(token)));
        tokenRepoMock.Setup(r => r.DeleteByTokenAsync(token, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(
            tokenRepoMock: tokenRepoMock,
            userRepoMock: Utilities.MockFactory.UserRepositoryFoundById(),
            httpClient: CreateHttpClient(HttpStatusCode.OK, staleJson));

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), CancellationToken.None);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.DeleteByTokenAsync(token, It.IsAny<CancellationToken>()), Times.Once);
    }
}
