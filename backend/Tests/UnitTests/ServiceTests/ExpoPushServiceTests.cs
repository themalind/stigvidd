// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Services;
using AwesomeAssertions;
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
        Mock<IConfiguration>? configMock = null,
        Mock<IUserBlockRepository>? blockRepoMock = null)
    {
        var defaultConfig = new Mock<IConfiguration>();
        defaultConfig.Setup(c => c[It.IsAny<string>()]).Returns((string?)null);

        var defaultBlockRepo = new Mock<IUserBlockRepository>();
        defaultBlockRepo.Setup(r => r.HasBlockedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        return new ExpoPushService(
            tokenRepoMock?.Object ?? new Mock<IUserPushTokenRepository>().Object,
            userRepoMock?.Object ?? new Mock<IUserRepository>().Object,
            blockRepoMock?.Object ?? defaultBlockRepo.Object,
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

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", TestContext.Current.CancellationToken);

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

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", TestContext.Current.CancellationToken);

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

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", TestContext.Current.CancellationToken);

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

        var result = await service.RegisterTokenAsync("identifier", "token", "ios", TestContext.Current.CancellationToken);

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

        var result = await service.UnregisterTokenAsync("identifier", "token", TestContext.Current.CancellationToken);

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

        var result = await service.UnregisterTokenAsync("identifier", "token", TestContext.Current.CancellationToken);

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

        var result = await service.UnregisterTokenAsync("identifier", "token", TestContext.Current.CancellationToken);

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

        var result = await service.UnregisterTokenAsync("identifier", "token", TestContext.Current.CancellationToken);

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

        var result = await service.UnregisterTokenAsync("identifier", "token", TestContext.Current.CancellationToken);

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

        var result = await service.UnregisterTokenAsync("identifier", "token", TestContext.Current.CancellationToken);

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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    // The whole point of a silent block: the sender is told nothing, so the send still reports Ok.
    [Fact]
    public async Task SendToUserAsync_WhenTheRecipientHasBlockedTheSender_SendsNothing()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Success(SingleToken()));

        var blockRepoMock = new Mock<IUserBlockRepository>();
        blockRepoMock.Setup(r => r.HasBlockedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(
            tokenRepoMock: tokenRepoMock,
            userRepoMock: Utilities.MockFactory.UserRepositoryFoundById(),
            blockRepoMock: blockRepoMock);

        var result = await service.SendToUserAsync(
            "identifier", "title", "body", new Dictionary<string, object>(),
            TestContext.Current.CancellationToken, fromUserIdentifier: "blocked-sender");

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Without a sender there is nobody to check, so a system notification is never suppressed.
    [Fact]
    public async Task SendToUserAsync_WithNoSenderNamed_IsNeverSuppressed()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<UserPushToken>>.Success(SingleToken()));

        var blockRepoMock = new Mock<IUserBlockRepository>();
        blockRepoMock.Setup(r => r.HasBlockedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(
            tokenRepoMock: tokenRepoMock,
            userRepoMock: Utilities.MockFactory.UserRepositoryFoundById(),
            blockRepoMock: blockRepoMock);

        var result = await service.SendToUserAsync(
            "identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.GetTokensForUserAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

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

        var result = await service.SendToUserAsync("identifier", "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.DeleteByTokenAsync(token, It.IsAny<CancellationToken>()), Times.Once);
    }

    private sealed class RecordingHttpMessageHandler(string jsonBody = """{"data": []}""") : HttpMessageHandler
    {
        public List<string> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Bodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(jsonBody, Encoding.UTF8, "application/json") };
        }
    }

    private static UserPushToken Token(int userId, string token) => new() { UserId = userId, ExpoToken = token, Platform = "ios" };

    private static Mock<IUserPushTokenRepository> TokensFor(params UserPushToken[] tokens)
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUsersAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserPushToken>>.Success(tokens));
        return tokenRepoMock;
    }

    [Fact]
    public async Task SendToUsersAsync_SendsEveryRecipientsDevicesInOneRequest()
    {
        var tokenRepoMock = TokensFor(Token(1, "t1"), Token(2, "t2a"), Token(2, "t2b"), Token(3, "t3"));
        var handler = new RecordingHttpMessageHandler();
        var service = Build(tokenRepoMock: tokenRepoMock, httpClient: new HttpClient(handler) { BaseAddress = new Uri("https://exp.host/") });

        var result = await service.SendToUsersAsync([1, 2, 3, 2], "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.GetTokensForUsersAsync(
            It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 3 && ids.ToHashSet().SetEquals(new[] { 1, 2, 3 })), It.IsAny<CancellationToken>()), Times.Once);
        handler.Bodies.Should().ContainSingle();
        foreach (var token in new[] { "t1", "t2a", "t2b", "t3" })
            handler.Bodies[0].Should().Contain($"\"to\":\"{token}\"");
    }

    [Fact]
    public async Task SendToUsersAsync_SkipsRecipientsWhoBlockedTheSender()
    {
        var tokenRepoMock = TokensFor(Token(1, "t1"));
        var blockRepoMock = new Mock<IUserBlockRepository>();
        blockRepoMock.Setup(r => r.GetUsersWhoBlockedAsync(99, It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int[]>.Success([2]));
        var service = Build(tokenRepoMock: tokenRepoMock, blockRepoMock: blockRepoMock);

        var result = await service.SendToUsersAsync([1, 2], "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken, fromUserId: 99);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.GetTokensForUsersAsync(
            It.Is<IReadOnlyCollection<int>>(ids => ids.SequenceEqual(new[] { 1 })), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendToUsersAsync_WhenEveryRecipientBlockedTheSender_SendsNothing()
    {
        var tokenRepoMock = TokensFor();
        var blockRepoMock = new Mock<IUserBlockRepository>();
        blockRepoMock.Setup(r => r.GetUsersWhoBlockedAsync(99, It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int[]>.Success([1, 2]));
        var service = Build(tokenRepoMock: tokenRepoMock, blockRepoMock: blockRepoMock);

        var result = await service.SendToUsersAsync([1, 2], "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken, fromUserId: 99);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.GetTokensForUsersAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendToUsersAsync_WhenTheBlockLookupFails_StillSendsToEveryone()
    {
        var tokenRepoMock = TokensFor(Token(1, "t1"), Token(2, "t2"));
        var blockRepoMock = new Mock<IUserBlockRepository>();
        blockRepoMock.Setup(r => r.GetUsersWhoBlockedAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int[]>.Error());
        var service = Build(tokenRepoMock: tokenRepoMock, blockRepoMock: blockRepoMock);

        var result = await service.SendToUsersAsync([1, 2], "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken, fromUserId: 99);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.GetTokensForUsersAsync(
            It.Is<IReadOnlyCollection<int>>(ids => ids.Count == 2), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendToUsersAsync_WhenGetTokensErrors_Returns500()
    {
        var tokenRepoMock = new Mock<IUserPushTokenRepository>();
        tokenRepoMock.Setup(r => r.GetTokensForUsersAsync(It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<UserPushToken>>.Error());
        var service = Build(tokenRepoMock: tokenRepoMock);

        var result = await service.SendToUsersAsync([1], "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task SendToUsersAsync_WhenOneDeviceIsNotRegistered_DeletesOnlyThatToken()
    {
        const string ticketsJson = """{"data": [{"status": "ok", "id": "a"}, {"status": "error", "id": null, "message": "Not registered", "details": {"error": "DeviceNotRegistered"}}]}""";
        var tokenRepoMock = TokensFor(Token(1, "t1"), Token(2, "t2"));
        tokenRepoMock.Setup(r => r.DeleteByTokenAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var service = Build(tokenRepoMock: tokenRepoMock, httpClient: CreateHttpClient(HttpStatusCode.OK, ticketsJson));

        var result = await service.SendToUsersAsync([1, 2], "title", "body", new Dictionary<string, object>(), TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        tokenRepoMock.Verify(r => r.DeleteByTokenAsync("t2", It.IsAny<CancellationToken>()), Times.Once);
        tokenRepoMock.Verify(r => r.DeleteByTokenAsync("t1", It.IsAny<CancellationToken>()), Times.Never);
    }
}
