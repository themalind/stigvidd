// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.HikeShare;
using static Core.Services.HikeShareRecipientService;

namespace UnitTests.ServiceTests;

public class HikeShareRecipientServiceTests
{
    public static HikeShareRecipientService Build(
        Mock<IHikeShareRecipientRepository>? hikeShareRecipientRepositoryMock = null,
        Mock<IUserRepository>? userRepositoryMock = null,
        Mock<IHikeRepository>? hikeRepositoryMock = null,
        Mock<IFriendRepository>? friendRepositoryMock = null,
        Mock<IPushNotificationService>? pushNotificationServiceMock = null,
        Mock<IHikeService>? hikeServiceMock = null)
    {
        var defaultPushMock = new Mock<IPushNotificationService>();
        defaultPushMock.Setup(p => p.SendToUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        // Dropping a share always ends with the orphan sweep; tests that care pass their own
        var defaultHikeServiceMock = new Mock<IHikeService>();
        defaultHikeServiceMock.Setup(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        return new HikeShareRecipientService(
            hikeShareRecipientRepositoryMock?.Object ?? new Mock<IHikeShareRecipientRepository>().Object,
            userRepositoryMock?.Object ?? new Mock<IUserRepository>().Object,
            hikeRepositoryMock?.Object ?? new Mock<IHikeRepository>().Object,
            friendRepositoryMock?.Object ?? new Mock<IFriendRepository>().Object,
            pushNotificationServiceMock?.Object ?? defaultPushMock.Object,
            hikeServiceMock?.Object ?? defaultHikeServiceMock.Object
        );
    }

    private static SenderProjection Sender(int id = 1) => new(id, "NaturElskaren");
    private static ReceiverProjection Receiver(int id = 2) => new(id, "recipient-identifier");

    private static Hike HikeOwnedByOther() => new()
    {
        Id = 10,
        Identifier = "hike-identifier",
        Name = "Test",
        CreatedBy = "owner-identifier",
        UserId = 99,
        GeoPath = UnitTests.Utilities.GeoPath(),
        HikeLength = 10,
        Duration = 3600,
        CreatedByNickName = "owner-nickname",
    };

    // The whole reshare gate is one question: does this sender hold an accepted share of
    // this hike that the owner marked as resharable? HikeShare is keyed on
    // (HikeId, SharedWithId), so at most one row can answer it. Every test that reaches past
    // the gate has to answer it; HasHikeSharedWithUserAsync is only the later duplicate
    // check against the *target*, and most tests return before reaching it.
    private static void AllowReshare(Mock<IHikeShareRecipientRepository> repoMock, bool allowed = true) =>
        repoMock.Setup(r => r.IsAllowedToReshareHikeAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(allowed));

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenRepositoryError_ReturnsServerError()
    {
        // Arrange
        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenSuccessful_ReturnsHikes()
    {
        // Arrange
        var hikes = new List<HikeShareRecipientResponse>
        {
            new() { HikeIdentifier = "id-1", HikeName = "Hike1", Coordinates = "[]" },
            new() { HikeIdentifier = "id-2", HikeName = "Hike2", Coordinates = "[]" }
        };

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success(hikes));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenSuccessful_ReturnsExtraFields()
    {
        // Arrange
        var hikes = new List<HikeShareRecipientResponse>
        {
            new()
            {
                HikeIdentifier = "id-1",
                HikeName = "Hike1",
                Coordinates = "[]",
                GettingThere = "Take bus 42",
                ParkingInfo = "Park near the church",
                Description = "Lovely forest hike"
            }
        };

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success(hikes));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        var hike = result.Value.First();
        hike.GettingThere.Should().Be("Take bus 42");
        hike.ParkingInfo.Should().Be("Park near the church");
        hike.Description.Should().Be("Lovely forest hike");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task GetAllHikesSharedWithUserAsync_ProjectsTheResharingFlagFromTheShare(bool allowResharing)
    {
        // Arrange — the other tests hand the repository a canned list, so nothing exercises
        // the projection itself. Capture it and run it: this is the only value that tells
        // the app whether to offer a reshare button, and a share row that loses it on the
        // way out means the user is offered a button that answers 403.
        Expression<Func<HikeShare, HikeShareRecipientResponse>>? projection = null;
        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetAllHikesSharedWithUserAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, Expression<Func<HikeShare, HikeShareRecipientResponse>>, CancellationToken>((_, selector, _) => projection = selector)
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success([]));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        await service.GetAllHikesSharedWithUserAsync("user-identifier", CancellationToken.None);

        // Assert
        projection.Should().NotBeNull();
        var response = projection!.Compile().Invoke(SharedHikeRow(allowResharing));
        response.AllowResharing.Should().Be(allowResharing);
    }

    // A HikeShare carrying every navigation property the recipient projection walks.
    private static HikeShare SharedHikeRow(bool allowResharing)
    {
        var hike = HikeOwnedByOther();
        hike.User = new User { Id = 99, Identifier = "owner-identifier", NickName = "owner-nickname", Email = "owner@example.com", SubjectId = "firebase-uid-owner" };

        return new HikeShare
        {
            HikeId = hike.Id,
            SharedById = 3,
            SharedWithId = 1,
            CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            AllowResharing = allowResharing,
            Hike = hike,
            SharedBy = new User { Id = 3, Identifier = "sharer-identifier", NickName = "Sharer", Email = "sharer@example.com", SubjectId = "firebase-uid-sharer" },
        };
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenCurrentUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenCurrentUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenNotAllowedToReshare_ReturnsForbidden()
    {
        // Arrange — the repository answers false for both causes: the hike was never shared
        // with this user, or it was but the owner did not opt in to letting it travel
        // further. They are indistinguishable here by design — the two causes are separated
        // in IsAllowedToReshareHikeAsync_WhenNoShareExists_ReturnsFalse and
        // IsAllowedToReshareHikeAsync_WhenOwnerDidNotAllowIt_ReturnsFalse. This is the GDPR
        // gate: without it a hike walks A → B → C → D unbounded, carrying the owner's home
        // coordinates to strangers.
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(repoMock, allowed: false);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert — and nothing was written
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You do not have permission to reshare this hike.");
        repoMock.Verify(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenResharePermissionCheckFails_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.IsAllowedToReshareHikeAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert — a failed lookup must not be read as "allowed"
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("Something went wrong when checking reshare permissions.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.NotFound());

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(repoMock);

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given name.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Error());

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(repoMock);

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenNotFriends_ReturnsForbidden()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(repoMock);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You can only share a hike with a friend.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToSelf_ReturnsBadRequest()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(1)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(repoMock);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Be("You cannot share a hike with yourself.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareToOwner_ReturnsBadRequest()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(99))); // matches hike.UserId

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(repoMock);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Be("You cannot reshare a hike to the owner.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAlreadySharedCheckFails_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // The duplicate check fails
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());
        AllowReshare(repoMock);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAlreadySharedWithTarget_ReturnsConflict()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // The duplicate check: the target already has this hike
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));
        AllowReshare(repoMock);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("This hike has already been shared with this user.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenTargetAlreadyHasPendingShare_ReturnsConflict()
    {
        // Arrange — recipient has a pending (not yet accepted) share for this hike;
        // the check must catch it so we don't silently create a duplicate request
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // The duplicate check counts pending shares too — see the repository test
        // HasHikeSharedWithUserAsync_WhenShareIsPending_ReturnsTrue
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true)); // pending share exists
        AllowReshare(repoMock);

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("This hike has already been shared with this user.");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // The only remaining call is the duplicate check: the target does not have it yet
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        AllowReshare(repoMock);
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // The only remaining call is the duplicate check: the target does not have it yet
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        AllowReshare(repoMock);
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenSuccessful_CutsTheChainOnTheNewShare()
    {
        // Arrange — the sender was allowed to reshare, so the reshare succeeds
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(Receiver(2)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        HikeShare? saved = null;
        var repoMock = new Mock<IHikeShareRecipientRepository>();
        // The only remaining call is the duplicate check: the target does not have it yet
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        AllowReshare(repoMock);
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .Callback<HikeShare, CancellationToken>((hs, _) => saved = hs)
            .ReturnsAsync(RepositoryResult.Success());

        var friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert — a hike moves at most one hop past its owner: whoever receives it this
        // way cannot pass it on, because only the owner may grant that permission
        result.Success.Should().BeTrue();
        saved.Should().NotBeNull();
        saved!.AllowResharing.Should().BeFalse();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenSuccessful_SendsPushNotificationToRecipient()
    {
        // Arrange
        var recipient = Receiver();
        var pushMock = ReshareSucceeds(out var userRepoMock, out var repoMock, out var hikeRepoMock, out var friendRepoMock, recipient);

        var service = Build(
            hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock,
            pushNotificationServiceMock: pushMock);

        // Act
        await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert — addressed to the recipient, and carrying the "hike_share" type the app
        // routes on. A reshare is indistinguishable from a first-hand share to them.
        pushMock.Verify(p => p.SendToUserAsync(
            recipient.Identifier,
            It.IsAny<string>(),
            It.Is<string>(body => body.Contains(Sender().NickName)),
            It.Is<IReadOnlyDictionary<string, object>>(d => d.ContainsKey("type") && d["type"].ToString() == "hike_share"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenPushNotificationFails_StillReturnsOk()
    {
        // Arrange — the share row is already committed by the time we notify, so a push
        // failure must not surface as a failed reshare
        var pushMock = ReshareSucceeds(out var userRepoMock, out var repoMock, out var hikeRepoMock, out var friendRepoMock);
        pushMock.Setup(p => p.SendToUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail(new Message(500, "Push failed")));

        var service = Build(
            hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock,
            pushNotificationServiceMock: pushMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenReshareRepositoryErrors_DoesNotSendPushNotification()
    {
        // Arrange
        var pushMock = ReshareSucceeds(out var userRepoMock, out var repoMock, out var hikeRepoMock, out var friendRepoMock);
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(
            hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, friendRepositoryMock: friendRepoMock,
            pushNotificationServiceMock: pushMock);

        // Act
        await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", "reshareToName", CancellationToken.None);

        // Assert — nothing was shared, so nobody should be told it was
        pushMock.Verify(p => p.SendToUserAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Every mock wired for a reshare that gets all the way through to the notification.
    // The three notification tests differ only in what they break afterwards.
    private static Mock<IPushNotificationService> ReshareSucceeds(
        out Mock<IUserRepository> userRepoMock,
        out Mock<IHikeShareRecipientRepository> repoMock,
        out Mock<IHikeRepository> hikeRepoMock,
        out Mock<IFriendRepository> friendRepoMock,
        ReceiverProjection? recipient = null)
    {
        userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender()));
        userRepoMock.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(recipient ?? Receiver()));

        hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        repoMock = new Mock<IHikeShareRecipientRepository>();
        // The only remaining call is the duplicate check: the target does not have it yet
        repoMock.Setup(r => r.HasHikeSharedWithUserAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        AllowReshare(repoMock);
        repoMock.Setup(r => r.ReshareSharedHikeAsync(It.IsAny<HikeShare>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        friendRepoMock = new Mock<IFriendRepository>();
        friendRepoMock.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        var pushMock = new Mock<IPushNotificationService>();
        pushMock.Setup(p => p.SendToUserAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok());

        return pushMock;
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenDeleteRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.DeleteHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.DeleteHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenSuccessful_SweepsOrphanedHikes()
    {
        // Arrange — this may have been the last recipient of a hike whose owner is already gone
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.DeleteHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var hikeServiceMock = new Mock<IHikeService>();
        hikeServiceMock.Setup(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, hikeServiceMock: hikeServiceMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        hikeServiceMock.Verify(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RemoveSharedHikeAsync_WhenDeleteFails_DoesNotSweep()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.DeleteHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var hikeServiceMock = new Mock<IHikeService>();

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, hikeServiceMock: hikeServiceMock);

        // Act
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", CancellationToken.None);

        // Assert — nothing was removed, so nothing can have been orphaned
        result.Success.Should().BeFalse();
        hikeServiceMock.Verify(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenSuccessful_SweepsOrphanedHikes()
    {
        // Arrange — a rejected share can have been the last one holding an ownerless hike alive
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var hikeServiceMock = new Mock<IHikeService>();
        hikeServiceMock.Setup(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock,
            hikeRepositoryMock: hikeRepoMock, hikeServiceMock: hikeServiceMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        hikeServiceMock.Verify(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // GetIncomingPendingSharesAsync

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingSharesForUserAsync(
                It.IsAny<int>(),
                It.IsAny<Expression<Func<HikeShare, IncomingHikeShareResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<IncomingHikeShareResponse>>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingSharesAsync_WhenSuccessful_ReturnsPendingShares()
    {
        // Arrange
        var shares = new List<IncomingHikeShareResponse>
        {
            IncomingHikeShareResponse.Create("hike-1", "TestHike1", 10, 3600, "Sender", "sender-id", "Creator", DateTime.UtcNow),
            IncomingHikeShareResponse.Create("hike-2", "TestHike2", 20, 7200, "Sender", "sender-id", "Creator", DateTime.UtcNow)
        };

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingSharesForUserAsync(
                It.IsAny<int>(),
                It.IsAny<Expression<Func<HikeShare, IncomingHikeShareResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<IncomingHikeShareResponse>>.Success(shares));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().HaveCount(2);
    }

    // GetIncomingPendingShareAsync

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenShareNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Pending share not found.");
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetIncomingPendingShareAsync_WhenSuccessful_ReturnsShare()
    {
        // Arrange
        var share = HikeShareRecipientResponse.Create(
            "hike-1", "TestHike1", 10, 3600, "[]", "Creator", "Sender", "sender-id",
            DateTime.UtcNow, null, null, "A lovely hike", allowResharing: true);

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.Success(share));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value!.HikeIdentifier.Should().Be("hike-1");
        result.Value.Description.Should().Be("A lovely hike");
        result.Value.AllowResharing.Should().BeTrue();
    }

    // AcceptHikeShareAsync

    [Fact]
    public async Task AcceptHikeShareAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.AcceptHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenShareNotFound_ReturnsNotFound()
    {
        // Arrange — repo returns NotFound when no pending row matches (hikeId, userId)
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.AcceptHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Pending share not found.");
    }

    [Fact]
    public async Task AcceptHikeShareAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.AcceptHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }

    // RejectHikeShareAsync

    [Fact]
    public async Task RejectHikeShareAsync_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("User not found with the given identifier.");
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenUserRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike not found with the given identifier.");
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenHikeRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenHikeShareNotFound_ReturnsNotFound()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Message.ResultMessage.Should().Be("Hike share not found.");
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenRepositoryErrors_ReturnsServerError()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task RejectHikeShareAsync_WhenSuccessful_ReturnsOk()
    {
        // Arrange
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.RejectHikeShareAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock, hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }
}