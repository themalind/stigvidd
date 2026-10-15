// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Core.Telemetry;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Moq;
using System.Linq.Expressions;
using UnitTests.Telemetry;
using WebDataContracts.ResponseModels.HikeShare;

namespace UnitTests.ServiceTests;

public class HikeShareRecipientServiceTests
{
    public static HikeShareRecipientService Build(
        Mock<IHikeShareRecipientRepository>? hikeShareRecipientRepositoryMock = null,
        Mock<IUserRepository>? userRepositoryMock = null,
        Mock<IHikeRepository>? hikeRepositoryMock = null,
        Mock<IFriendRepository>? friendRepositoryMock = null,
        Mock<IUserBlockService>? userBlockServiceMock = null,
        Mock<IPushNotificationService>? pushNotificationServiceMock = null,
        Mock<IHikeService>? hikeServiceMock = null,
        Mock<IHikeShareRepository>? hikeShareRepositoryMock = null,
        StigviddMetrics? metrics = null)
    {
        // Dropping a share always ends with the orphan sweep; tests that care pass their own
        var defaultHikeServiceMock = new Mock<IHikeService>();
        defaultHikeServiceMock.Setup(h => h.CleanUpOrphanedHikesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var userRepository = userRepositoryMock ?? new Mock<IUserRepository>();

        return new HikeShareRecipientService(
            hikeShareRecipientRepositoryMock?.Object ?? new Mock<IHikeShareRecipientRepository>().Object,
            userRepository.Object,
            hikeRepositoryMock?.Object ?? new Mock<IHikeRepository>().Object,
            (userBlockServiceMock ?? Utilities.MockFactory.UserBlockServiceHiding()).Object,
            HikeShareDistributorTests.Distributor(userRepository, friendRepositoryMock, hikeShareRepositoryMock, pushNotificationServiceMock),
            metrics ?? new StigviddMetrics(),
            hikeServiceMock?.Object ?? defaultHikeServiceMock.Object,
            Utilities.Stubs.HikeResponseFactory()
        );
    }

    private static SenderProjection Sender(int id = 1) => new(id, "NaturElskaren");

    // Sender, hike and reshare permission all answer yes, so a test only sets up the distribution side.
    private static (Mock<IUserRepository> UserRepo, Mock<IHikeRepository> HikeRepo, Mock<IHikeShareRecipientRepository> RecipientRepo) AllowedResharer()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(Sender(1)));

        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(HikeOwnedByOther()));

        var recipientRepoMock = new Mock<IHikeShareRecipientRepository>();
        AllowReshare(recipientRepoMock);

        return (userRepoMock, hikeRepoMock, recipientRepoMock);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAllowed_SharesWithoutPassingOnTheResharingRight()
    {
        // Arrange
        var (userRepoMock, hikeRepoMock, recipientRepoMock) = AllowedResharer();
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Vän", 2);
        var shareRepoMock = HikeShareDistributorTests.ShareRepo();
        IReadOnlyCollection<HikeShare>? saved = null;
        shareRepoMock.Setup(r => r.ShareHikesAsync(It.IsAny<IReadOnlyCollection<HikeShare>>(), It.IsAny<CancellationToken>()))
            .Callback<IReadOnlyCollection<HikeShare>, CancellationToken>((hs, _) => saved = hs)
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(recipientRepoMock, userRepoMock, hikeRepoMock,
            friendRepositoryMock: HikeShareDistributorTests.Friends(), hikeShareRepositoryMock: shareRepoMock);

        // Act
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["Vän"], TestContext.Current.CancellationToken);

        // Assert — a hike moves at most one hop past its owner, because only the owner may grant that permission
        result.Success.Should().BeTrue();
        saved.Should().NotBeNull();
        var share = saved.Should().ContainSingle().Subject;
        share.AllowResharing.Should().BeFalse();
        share.SharedById.Should().Be(Sender().Id);
        share.SharedWithId.Should().Be(2);
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_RecordsOneReshare_WithItsNewRecipientCount()
    {
        // Arrange
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);
        var (userRepoMock, hikeRepoMock, recipientRepoMock) = AllowedResharer();
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Vän", 2);
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Kompis", 3);

        var service = Build(recipientRepoMock, userRepoMock, hikeRepoMock,
            friendRepositoryMock: HikeShareDistributorTests.Friends(), hikeShareRepositoryMock: HikeShareDistributorTests.ShareRepo(), metrics: metrics);

        // Act
        await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["Vän", "Kompis"], TestContext.Current.CancellationToken);

        // Assert
        recorded.PublishedInstruments.Should().Contain(MetricNames.HikeShareCreated);
        var share = recorded.For(MetricNames.HikeShareCreated).Should().ContainSingle().Subject;
        share.Tags.Should().Contain("kind", "reshare");
        share.Tags.Should().Contain("outcome", "success");
        var recipients = recorded.For(MetricNames.HikeShareRecipients).Should().ContainSingle().Subject;
        recipients.Value.Should().Be(2);
        recipients.Tags.Keys.Should().OnlyContain(k => k == "kind");
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenNotAllowed_RecordsForbiddenAndNoRecipientCount()
    {
        // Arrange
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);
        var (userRepoMock, hikeRepoMock, recipientRepoMock) = AllowedResharer();
        AllowReshare(recipientRepoMock, allowed: false);

        var service = Build(recipientRepoMock, userRepoMock, hikeRepoMock, metrics: metrics);

        // Act
        await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["Vän"], TestContext.Current.CancellationToken);

        // Assert
        recorded.For(MetricNames.HikeShareCreated).Should().ContainSingle()
            .Which.Tags.Should().Contain("outcome", "forbidden");
        recorded.For(MetricNames.HikeShareRecipients).Should().BeEmpty();
    }

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success(hikes));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success(hikes));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        var result = await service.GetAllHikesSharedWithUserAsync("user-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, int[], Expression<Func<HikeShare, HikeShareRecipientResponse>>, CancellationToken>((_, _, selector, _) => projection = selector)
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<HikeShareRecipientResponse>>.Success([]));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock);

        // Act
        await service.GetAllHikesSharedWithUserAsync("user-identifier", TestContext.Current.CancellationToken);

        // Assert
        projection.Should().NotBeNull();
        var response = projection.Compile().Invoke(SharedHikeRow(allowResharing));
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
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["reshareToName"], TestContext.Current.CancellationToken);

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
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["reshareToName"], TestContext.Current.CancellationToken);

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
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["reshareToName"], TestContext.Current.CancellationToken);

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
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["reshareToName"], TestContext.Current.CancellationToken);

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
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["reshareToName"], TestContext.Current.CancellationToken);

        // Assert — refused before any name is looked up, so nothing is learned and nothing written
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You do not have permission to reshare this hike.");
        userRepoMock.Verify(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()), Times.Never);
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
        var result = await service.ReshareSharedHikeAsync("hike-identifier", "user-identifier", ["reshareToName"], TestContext.Current.CancellationToken);

        // Assert — a failed lookup must not be read as "allowed"
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        result.Message.ResultMessage.Should().Be("Something went wrong when checking reshare permissions.");
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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RemoveSharedHikeAsync("hike-identifier", "user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, IncomingHikeShareResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<IncomingHikeShareResponse>>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, IncomingHikeShareResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<IncomingHikeShareResponse>>.Success(shares));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingSharesAsync("user-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.NotFound());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.Error());

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
            DateTime.UtcNow, null, null, "A lovely hike", allowResharing: true, images: []);

        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var repoMock = new Mock<IHikeShareRecipientRepository>();
        repoMock.Setup(r => r.GetPendingShareByIdentifierAsync(
                It.IsAny<int>(), It.IsAny<string>(),
                It.IsAny<int[]>(), It.IsAny<Expression<Func<HikeShare, HikeShareRecipientResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<HikeShareRecipientResponse>.Success(share));

        var service = Build(hikeShareRecipientRepositoryMock: repoMock, userRepositoryMock: userRepoMock);

        // Act
        var result = await service.GetIncomingPendingShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
        result.Value.Should().NotBeNull();
        result.Value.HikeIdentifier.Should().Be("hike-1");
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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.AcceptHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.RejectHikeShareAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Message.Should().BeNull();
    }
}
