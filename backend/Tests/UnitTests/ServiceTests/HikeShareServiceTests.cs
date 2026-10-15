// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Core.Telemetry;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using System.Linq.Expressions;
using UnitTests.Telemetry;

namespace UnitTests.ServiceTests;

// Who may share, and what a share records. What happens per recipient is in HikeShareDistributorTests.
public class HikeShareServiceTests
{
    private const string OwnerIdentifier = "user-identifier";

    public static HikeShareService Build(
        Mock<IHikeShareRepository>? hikeShareRepositoryMock = null,
        Mock<IUserRepository>? userRepositoryMock = null,
        Mock<IHikeRepository>? hikeRepositoryMock = null,
        Mock<IFriendRepository>? friendRepositoryMock = null,
        Mock<IPushNotificationService>? pushNotificationServiceMock = null,
        StigviddMetrics? metrics = null)
    {
        var userRepository = userRepositoryMock ?? new Mock<IUserRepository>();
        var shareRepository = hikeShareRepositoryMock ?? HikeShareDistributorTests.ShareRepo();

        return new HikeShareService(
            shareRepository.Object,
            userRepository.Object,
            hikeRepositoryMock?.Object ?? new Mock<IHikeRepository>().Object,
            HikeShareDistributorTests.Distributor(userRepository, friendRepositoryMock, shareRepository, pushNotificationServiceMock),
            metrics ?? new StigviddMetrics(),
            new Mock<ILogger<HikeShareService>>().Object
        );
    }

    private static Mock<IUserRepository> SenderFound()
    {
        var userRepoMock = new Mock<IUserRepository>();
        userRepoMock.Setup(r => r.GetUserByIdentifierAsync(
                It.IsAny<string>(), It.IsAny<Expression<Func<User, SenderProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<SenderProjection>.Success(new SenderProjection(1, "NaturElskaren")));
        return userRepoMock;
    }

    private static Mock<IHikeRepository> HikeCreatedBy(string creatorIdentifier)
    {
        var hike = new Hike { Id = 1, Identifier = "hike-identifier", Name = "Test", CreatedBy = creatorIdentifier, UserId = 1, GeoPath = Utilities.GeoPath(), HikeLength = 10, Duration = 3600, CreatedByNickName = "NaturElskaren" };
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Success(hike));
        return hikeRepoMock;
    }

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
        var result = await service.GetHikeShareCountAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.GetHikeShareCountAsync("user-identifier", "hike-identifier", TestContext.Current.CancellationToken);

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
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän"], allowResharing: false, TestContext.Current.CancellationToken);

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
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän"], allowResharing: false, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenHikeNotFound_ReturnsNotFound()
    {
        // Arrange
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.NotFound());

        var service = Build(userRepositoryMock: SenderFound(), hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän"], allowResharing: false, TestContext.Current.CancellationToken);

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
        var hikeRepoMock = new Mock<IHikeRepository>();
        hikeRepoMock.Setup(r => r.GetHikeByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Hike>.Error());

        var service = Build(userRepositoryMock: SenderFound(), hikeRepositoryMock: hikeRepoMock);

        // Act
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän"], allowResharing: false, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenUserDoesNotOwnHike_IsRefusedBeforeAnyNameIsLookedUp()
    {
        // Arrange
        var userRepoMock = SenderFound();
        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: HikeCreatedBy("another-user-identifier"));

        // Act
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän"], allowResharing: false, TestContext.Current.CancellationToken);

        // Assert — a non-owner gets 403 whatever names they send, so they cannot probe nicknames
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(403);
        result.Message.ResultMessage.Should().Be("You do not have permission to share this hike.");
        userRepoMock.Verify(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ShareHikeAsync_WhenOwner_PersistsTheOwnersResharingChoice(bool allowResharing)
    {
        // Arrange
        var userRepoMock = SenderFound();
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Vän", 2);
        IReadOnlyCollection<HikeShare>? saved = null;
        var shareRepoMock = HikeShareDistributorTests.ShareRepo();
        shareRepoMock.Setup(r => r.ShareHikesAsync(It.IsAny<IReadOnlyCollection<HikeShare>>(), It.IsAny<CancellationToken>()))
            .Callback<IReadOnlyCollection<HikeShare>, CancellationToken>((hs, _) => saved = hs)
            .ReturnsAsync(RepositoryResult.Success());

        var service = Build(shareRepoMock, userRepoMock, HikeCreatedBy(OwnerIdentifier));

        // Act
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän"], allowResharing, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        saved.Should().NotBeNull();
        saved.Should().ContainSingle().Which.AllowResharing.Should().Be(allowResharing);
    }

    [Fact]
    public async Task ShareHikeAsync_RecordsOneShare_WithItsNewRecipientCount()
    {
        // Arrange
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);
        var userRepoMock = SenderFound();
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Vän", 2);
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Kompis", 3);

        var service = Build(HikeShareDistributorTests.ShareRepo(alreadyHaveIt: 3), userRepoMock, HikeCreatedBy(OwnerIdentifier), metrics: metrics);

        // Act
        await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Vän", "Kompis"], allowResharing: false, TestContext.Current.CancellationToken);

        // Assert — Kompis already had it, so one new recipient
        recorded.PublishedInstruments.Should().Contain(MetricNames.HikeShareCreated);
        var share = recorded.For(MetricNames.HikeShareCreated).Should().ContainSingle().Subject;
        share.Tags.Should().Contain("kind", "share");
        share.Tags.Should().Contain("outcome", "success");
        share.Tags.Keys.Should().OnlyContain(k => k == "kind" || k == "outcome");
        recorded.For(MetricNames.HikeShareRecipients).Should().ContainSingle().Which.Value.Should().Be(1);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenARecipientIsNotAFriend_RecordsNotFound()
    {
        // Arrange
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);
        var userRepoMock = SenderFound();
        HikeShareDistributorTests.FriendNamed(userRepoMock, "Främling", 5);

        var service = Build(userRepositoryMock: userRepoMock, hikeRepositoryMock: HikeCreatedBy(OwnerIdentifier),
            friendRepositoryMock: HikeShareDistributorTests.Friends(false), metrics: metrics);

        // Act
        var result = await service.ShareHikeAsync(OwnerIdentifier, "hike-identifier", ["Främling"], allowResharing: false, TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        recorded.For(MetricNames.HikeShareCreated).Should().ContainSingle()
            .Which.Tags.Should().Contain("outcome", "not_found");
        recorded.For(MetricNames.HikeShareRecipients).Should().BeEmpty();
    }
}
