// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using System.Linq.Expressions;

namespace UnitTests.ServiceTests;

public class HikeShareDistributorTests
{
    private const int SenderId = 1;
    private const string SenderNickName = "NaturElskaren";
    private const int OwnerId = 99;

    internal static HikeShareDistributor Distributor(
        Mock<IUserRepository> userRepo,
        Mock<IFriendRepository>? friendRepo = null,
        Mock<IHikeShareRepository>? shareRepo = null,
        Mock<IPushNotificationService>? push = null) =>
        new(
            userRepo.Object,
            (friendRepo ?? Friends()).Object,
            (shareRepo ?? ShareRepo()).Object,
            (push ?? Push()).Object,
            NullLogger<HikeShareDistributor>.Instance);

    internal static void FriendNamed(Mock<IUserRepository> userRepo, string nickName, int id) =>
        userRepo.Setup(r => r.GetUserByNickNameAsync(nickName, It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Success(new ReceiverProjection(id, $"identifier-{id}")));

    internal static Mock<IFriendRepository> Friends(bool areFriends = true)
    {
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(areFriends));
        return friendRepo;
    }

    internal static Mock<IHikeShareRepository> ShareRepo(params int[] alreadyHaveIt)
    {
        var shareRepo = new Mock<IHikeShareRepository>();
        shareRepo.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int _, int sharedWithId, CancellationToken _) => RepositoryResult<bool>.Success(alreadyHaveIt.Contains(sharedWithId)));
        shareRepo.Setup(r => r.ShareHikesAsync(It.IsAny<IReadOnlyCollection<HikeShare>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        return shareRepo;
    }

    private static Mock<IPushNotificationService> Push()
    {
        var push = new Mock<IPushNotificationService>();
        push.Setup(p => p.SendToUsersAsync(
                It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
            .ReturnsAsync(Result.Ok());
        return push;
    }

    private static Hike OwnedHike() => new()
    {
        Id = 10,
        Identifier = "hike-identifier",
        Name = "Test",
        CreatedBy = "owner-identifier",
        UserId = OwnerId,
        GeoPath = Utilities.GeoPath(),
        HikeLength = 10,
        Duration = 3600,
        CreatedByNickName = "owner-nickname",
    };

    private static Task<Result<int>> Distribute(HikeShareDistributor distributor, IReadOnlyCollection<string> names, bool allowResharing = false) =>
        distributor.DistributeAsync(SenderId, SenderNickName, OwnedHike(), names, allowResharing, TestContext.Current.CancellationToken);

    private static void VerifyNothingShared(Mock<IHikeShareRepository> shareRepo, Mock<IPushNotificationService> push)
    {
        shareRepo.Verify(r => r.ShareHikesAsync(It.IsAny<IReadOnlyCollection<HikeShare>>(), It.IsAny<CancellationToken>()), Times.Never);
        push.Verify(p => p.SendToUsersAsync(
            It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()), Times.Never);
    }

    [Fact]
    public async Task WhenANameIsUnknown_Returns404AndSharesWithNobody()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        userRepo.Setup(r => r.GetUserByNickNameAsync("Okänd", It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.NotFound());
        var shareRepo = ShareRepo();
        var push = Push();

        // Act
        var result = await Distribute(Distributor(userRepo, shareRepo: shareRepo, push: push), ["Vän", "Okänd"]);

        // Assert — all-or-nothing: the valid friend does not get it either
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        VerifyNothingShared(shareRepo, push);
    }

    [Fact]
    public async Task WhenARecipientIsNotAFriend_AnswersExactlyLikeAnUnknownName()
    {
        // Arrange
        var unknownRepo = new Mock<IUserRepository>();
        unknownRepo.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.NotFound());
        var strangerRepo = new Mock<IUserRepository>();
        FriendNamed(strangerRepo, "Främling", 5);
        var shareRepo = ShareRepo();
        var push = Push();

        // Act
        var unknown = await Distribute(Distributor(unknownRepo), ["Främling"]);
        var stranger = await Distribute(Distributor(strangerRepo, Friends(false), shareRepo, push), ["Främling"]);

        // Assert — the same status and message, so a share request cannot probe which nicknames exist
        unknown.Message.Should().NotBeNull();
        stranger.Message.Should().NotBeNull();
        stranger.Message.StatusCode.Should().Be(404);
        stranger.Message.ResultMessage.Should().Be(unknown.Message.ResultMessage);
        VerifyNothingShared(shareRepo, push);
    }

    [Fact]
    public async Task WhenSharingWithSelf_Returns400()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, SenderNickName, SenderId);

        // Act
        var result = await Distribute(Distributor(userRepo), [SenderNickName]);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task WhenTheRecipientLookupErrors_Returns500()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserByNickNameAsync(It.IsAny<string>(), It.IsAny<Expression<Func<User, ReceiverProjection>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReceiverProjection>.Error());

        // Act
        var result = await Distribute(Distributor(userRepo), ["Vän"]);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task WhenTheFriendshipCheckErrors_Returns500()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        var friendRepo = new Mock<IFriendRepository>();
        friendRepo.Setup(r => r.FriendshipExistsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        // Act
        var result = await Distribute(Distributor(userRepo, friendRepo), ["Vän"]);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task WhenTheOwnerIsAmongTheRecipients_SkipsThemSilently()
    {
        // Arrange — a resharer picking the owner, who already has the hike
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Ägaren", OwnerId);
        var shareRepo = ShareRepo();
        var push = Push();

        // Act
        var result = await Distribute(Distributor(userRepo, shareRepo: shareRepo, push: push), ["Ägaren"]);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(0);
        VerifyNothingShared(shareRepo, push);
    }

    [Fact]
    public async Task WhenEveryoneAlreadyHasIt_SucceedsWithoutWritingOrNotifying()
    {
        // Arrange — pending or accepted, IsAlreadySharedAsync counts both
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        var shareRepo = ShareRepo(alreadyHaveIt: 2);
        var push = Push();

        // Act
        var result = await Distribute(Distributor(userRepo, shareRepo: shareRepo, push: push), ["Vän"]);

        // Assert — the same answer as a fresh share, so the sender cannot tell who had it
        result.Success.Should().BeTrue();
        result.Value.Should().Be(0);
        VerifyNothingShared(shareRepo, push);
    }

    [Fact]
    public async Task WhenTheAlreadySharedCheckErrors_Returns500()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        var shareRepo = ShareRepo();
        shareRepo.Setup(r => r.IsAlreadySharedAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Error());

        // Act
        var result = await Distribute(Distributor(userRepo, shareRepo: shareRepo), ["Vän"]);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task WithSeveralRecipients_SharesOnceWithEachNewOneAndNotifiesThemInOneCall()
    {
        // Arrange — Kompis already has it, and Vän is named twice
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        FriendNamed(userRepo, "Kompis", 3);
        FriendNamed(userRepo, "Granne", 4);
        IReadOnlyCollection<HikeShare>? saved = null;
        var shareRepo = ShareRepo(alreadyHaveIt: 3);
        shareRepo.Setup(r => r.ShareHikesAsync(It.IsAny<IReadOnlyCollection<HikeShare>>(), It.IsAny<CancellationToken>()))
            .Callback<IReadOnlyCollection<HikeShare>, CancellationToken>((hs, _) => saved = hs)
            .ReturnsAsync(RepositoryResult.Success());
        var push = Push();

        // Act
        var result = await Distribute(Distributor(userRepo, shareRepo: shareRepo, push: push), ["Vän", "Kompis", "Granne", "Vän"], allowResharing: true);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(2);
        saved.Should().NotBeNull();
        saved.Select(s => s.SharedWithId).Should().BeEquivalentTo([2, 4]);
        saved.Should().OnlyContain(s => s.HikeId == 10 && s.SharedById == SenderId && s.AllowResharing);
        push.Verify(p => p.SendToUsersAsync(
            It.Is<IReadOnlyCollection<int>>(ids => ids.OrderBy(i => i).SequenceEqual(new[] { 2, 4 })),
            It.IsAny<string>(),
            It.Is<string>(body => body.Contains(SenderNickName)),
            It.Is<IReadOnlyDictionary<string, object>>(d => d["type"].ToString() == "hike_share"),
            It.IsAny<CancellationToken>(),
            SenderId), Times.Once);
    }

    [Fact]
    public async Task WhenTheInsertFails_Returns500AndNotifiesNobody()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        var shareRepo = ShareRepo();
        shareRepo.Setup(r => r.ShareHikesAsync(It.IsAny<IReadOnlyCollection<HikeShare>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());
        var push = Push();

        // Act
        var result = await Distribute(Distributor(userRepo, shareRepo: shareRepo, push: push), ["Vän"]);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        push.Verify(p => p.SendToUsersAsync(
            It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()), Times.Never);
    }

    [Fact]
    public async Task WhenThePushFails_TheShareStillSucceeds()
    {
        // Arrange — the rows are committed before anyone is notified
        var userRepo = new Mock<IUserRepository>();
        FriendNamed(userRepo, "Vän", 2);
        var push = Push();
        push.Setup(p => p.SendToUsersAsync(
                It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, object>>(), It.IsAny<CancellationToken>(), It.IsAny<int?>()))
            .ReturnsAsync(Result.Fail(new Message(500, "Push failed")));

        // Act
        var result = await Distribute(Distributor(userRepo, push: push), ["Vän"]);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(1);
    }
}
