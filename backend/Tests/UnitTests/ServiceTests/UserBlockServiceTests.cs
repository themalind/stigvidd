// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.Friend;

namespace UnitTests.ServiceTests;

public class UserBlockServiceTests
{
    private const int CurrentUserId = 1;
    private const int TargetUserId = 2;

    private static UserBlockService Build(
        Mock<IUserBlockRepository>? blockRepo = null,
        Mock<IUserRepository>? userRepo = null)
    {
        // A mock passed in is used as it stands, so a failure the test set up is not stubbed over.
        if (blockRepo is null)
        {
            blockRepo = new Mock<IUserBlockRepository>();
            Healthy(blockRepo);
        }

        if (userRepo is null)
        {
            userRepo = new Mock<IUserRepository>();
            userRepo.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(RepositoryResult<int>.Success(CurrentUserId))
                .ReturnsAsync(RepositoryResult<int>.Success(TargetUserId));
        }

        return new UserBlockService(blockRepo.Object, userRepo.Object);
    }

    private static void Healthy(Mock<IUserBlockRepository> mock) =>
        mock.Setup(r => r.BlockAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

    // Recording the block is the only write.
    [Fact]
    public async Task BlockUserAsync_RecordsTheBlockAndNothingElse()
    {
        // Arrange
        var blockRepo = new Mock<IUserBlockRepository>();
        Healthy(blockRepo);
        var service = Build(blockRepo);

        // Act
        var result = await service.BlockUserAsync("current", "target", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        blockRepo.Verify(r => r.BlockAsync(CurrentUserId, TargetUserId, It.IsAny<CancellationToken>()), Times.Once);
        blockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task BlockUserAsync_WhenBlockingYourself_ReturnsBadRequest()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(CurrentUserId));
        var blockRepo = new Mock<IUserBlockRepository>();
        var service = Build(blockRepo, userRepo: userRepo);

        // Act
        var result = await service.BlockUserAsync("current", "current", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        blockRepo.Verify(r => r.BlockAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task BlockUserAsync_WhenTheTargetIsUnknown_ReturnsNotFound()
    {
        // Arrange
        var userRepo = new Mock<IUserRepository>();
        userRepo.SetupSequence(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(CurrentUserId))
            .ReturnsAsync(RepositoryResult<int>.NotFound());
        var blockRepo = new Mock<IUserBlockRepository>();
        var service = Build(blockRepo, userRepo: userRepo);

        // Act
        var result = await service.BlockUserAsync("current", "nobody", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        blockRepo.Verify(r => r.BlockAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task BlockUserAsync_WhenRecordingTheBlockFails_ReturnsInternalServerError()
    {
        // Arrange
        var blockRepo = new Mock<IUserBlockRepository>();
        blockRepo.Setup(r => r.BlockAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());
        var service = Build(blockRepo);

        // Act
        var result = await service.BlockUserAsync("current", "target", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UnblockUserAsync_WhenThereIsNoBlock_ReturnsNotFound()
    {
        // Arrange
        var blockRepo = new Mock<IUserBlockRepository>();
        blockRepo.Setup(r => r.UnblockAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());
        var service = Build(blockRepo);

        // Act
        var result = await service.UnblockUserAsync("current", "target", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UnblockUserAsync_RemovesOnlyTheBlock()
    {
        // Arrange
        var blockRepo = new Mock<IUserBlockRepository>();
        blockRepo.Setup(r => r.UnblockAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());
        var service = Build(blockRepo);

        // Act
        var result = await service.UnblockUserAsync("current", "target", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        blockRepo.Verify(r => r.UnblockAsync(CurrentUserId, TargetUserId, It.IsAny<CancellationToken>()), Times.Once);
        blockRepo.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetBlockedUsersAsync_ReturnsWhatTheRepositoryProjected()
    {
        // Arrange
        var blockedAt = new DateTime(2026, 9, 20, 10, 0, 0, DateTimeKind.Utc);
        IReadOnlyCollection<BlockedUserResponse> blocked =
        [
            BlockedUserResponse.Create("blocked-identifier", "Grima", blockedAt)
        ];

        var blockRepo = new Mock<IUserBlockRepository>();
        blockRepo.Setup(r => r.GetBlockedByUserAsync(
                It.IsAny<int>(),
                It.IsAny<Expression<Func<UserBlock, User, BlockedUserResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<BlockedUserResponse>>.Success(blocked));

        var userRepo = new Mock<IUserRepository>();
        userRepo.Setup(r => r.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(CurrentUserId));

        var service = Build(blockRepo, userRepo: userRepo);

        // Act
        var result = await service.GetBlockedUsersAsync("current", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().ContainSingle();
        result.Value.Single().NickName.Should().Be("Grima");
        result.Value.Single().BlockedAt.Should().Be(blockedAt);
    }
}
