using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using System.Linq.Expressions;
using static Core.Services.HikeShareService;

namespace UnitTests.ServiceTests;

public class HikeShareServiceTests
{
    public static HikeShareService Build(
        Mock<IHikeShareRepository>? hikeShareRepositoryMock = null,
        Mock<IUserRepository>? userRepositoryMock = null,
        Mock<IHikeRepository>? hikeRepositoryMock = null,
        Mock<IFriendRepository>? friendRepositoryMock = null,
        Mock<IPushNotificationService>? pushNotificationServiceMock = null)
    {
        var defaultPushMock = new Mock<IPushNotificationService>();
        defaultPushMock.Setup(p => p.SendToUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        return new HikeShareService(
            hikeShareRepositoryMock?.Object ?? new Mock<IHikeShareRepository>().Object,
            userRepositoryMock?.Object ?? new Mock<IUserRepository>().Object,
            hikeRepositoryMock?.Object ?? new Mock<IHikeRepository>().Object,
            friendRepositoryMock?.Object ?? new Mock<IFriendRepository>().Object,
            pushNotificationServiceMock?.Object ?? defaultPushMock.Object,
            new Mock<ILogger<HikeShareService>>().Object
        );
    }

    private static SenderProjection Sender(int id = 1) => new(id, "NaturElskaren");
    private static ReceiverProjection Receiver(int id = 2) => new(id, "recipient-identifier");

    // GetHikeShareCountAsync

    [Fact]
    public async Task GetHikeShareCountAsync_WhenRepositoryError_ReturnsServerError()
    {
        // Arrange
        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.GetHikeShareCountAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(hikeShareRepositoryMock: hikeShareRepoMock);

        // Act
        var result = await service.GetHikeShareCountAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetHikeShareCountAsync_WhenSuccessful_ReturnsCount()
    {
        // Arrange
        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.GetHikeShareCountAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(3));

        var service = Build(hikeShareRepositoryMock: hikeShareRepoMock);

        // Act
        var result = await service.GetHikeShareCountAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().Be(3);
    }

    // ShareHikeAsync

    [Fact]
    public async Task ShareHikeAsync_WhenCurrentUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenCurrentUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenSharedWithUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given name.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenSharedWithUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenNotFriends_ReturnsForbidden()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You can only share a hike with a friend.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenSharingWithSelf_ReturnsBadRequest()
    {
        // Arrange — sender and recipient resolve to the same ID
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(id: 1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(id: 1))); // same ID as sender

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(userRepositoryMock: userRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Be("You cannot share a hike with yourself.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync("user-identifier", "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenUserDoesNotOwnHike_ReturnsForbidden()
    {
        // Arrange
        const string userIdentifier = "user-identifier";
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = "another-user-identifier", UserId = 3, Coordinates = "", HikeLength = 10, Duration = 3600 };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync(userIdentifier, "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You do not have permission to share this hike.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenAlreadySharedCheckErrors_ReturnsServerError()
    {
        // Arrange
        const string userIdentifier = "user-identifier";
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = userIdentifier, UserId = 1, Coordinates = "", HikeLength = 10, Duration = 3600 };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRepositoryMock: hikeShareRepoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync(userIdentifier, "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenHikeAlreadySharedWithUser_ReturnsConflict()
    {
        // Arrange
        const string userIdentifier = "user-identifier";
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = userIdentifier, UserId = 1, Coordinates = "", HikeLength = 10, Duration = 3600 };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRepositoryMock: hikeShareRepoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync(userIdentifier, "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("This hike has already been shared with this user.");
    }

    [Fact]
    public async Task ShareHikeAsync_WhenShareRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        const string userIdentifier = "user-identifier";
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = userIdentifier, UserId = 1, Coordinates = "", HikeLength = 10, Duration = 3600 };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        hikeShareRepoMock.Setup(r => r.ShareHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRepositoryMock: hikeShareRepoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync(userIdentifier, "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        const string userIdentifier = "user-identifier";
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver()));

        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = userIdentifier, UserId = 1, Coordinates = "", HikeLength = 10, Duration = 3600 };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        hikeShareRepoMock.Setup(r => r.ShareHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRepositoryMock: hikeShareRepoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ShareHikeAsync(userIdentifier, "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task ShareHikeAsync_WhenSuccessful_SendsPushNotificationToRecipient()
    {
        // Arrange
        const string userIdentifier = "user-identifier";
        var receiver = Receiver();

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(receiver));

        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = userIdentifier, UserId = 1, Coordinates = "", HikeLength = 10, Duration = 3600 };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));

        var hikeShareRepoMock = new Mock<IHikeShareRepository>();
        hikeShareRepoMock.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        hikeShareRepoMock.Setup(r => r.ShareHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var pushMock = new Mock<IPushNotificationService>();
        pushMock.Setup(p => p.SendToUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        var service = Build(
            hikeShareRepositoryMock: hikeShareRepoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock,
            pushNotificationServiceMock: pushMock);

        // Act
        await service.ShareHikeAsync(userIdentifier, "hike-identifier", "sharedWithName", CancellationToken.None);

        // Assert
        pushMock.Verify(p => p.SendToUserAsync(
            receiver.Identifier,
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.Is<IReadOnlyDictionary<string, object>>(d => d.ContainsKey("type") && d["type"].ToString() == "hike_share"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
