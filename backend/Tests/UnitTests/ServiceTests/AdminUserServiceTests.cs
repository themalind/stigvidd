// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Services;
using AwesomeAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace UnitTests.ServiceTests;

public class AdminUserServiceTests
{
    private const string Identifier = "user-identifier";

    private static Mock<IUserRepository> UserRepo(RepositoryResult outcome)
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.BanUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(outcome);
        repo.Setup(r => r.UnbanUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(outcome);
        return repo;
    }

    private static AdminUserService Build(Mock<IUserRepository> userRepo, ILogger<AdminUserService>? logger = null) =>
        new(userRepo.Object, logger ?? new Mock<ILogger<AdminUserService>>().Object);

    [Fact]
    public async Task BanAsync_StampsTheBanWithWhoAndWhy()
    {
        // Arrange
        var userRepo = UserRepo(RepositoryResult.Success());

        // Act
        var result = await Build(userRepo).BanAsync(Identifier, "moderator", "spam", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        userRepo.Verify(r => r.BanUserAsync(Identifier, "moderator", "spam", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UnbanAsync_ClearsTheBan()
    {
        // Arrange
        var userRepo = UserRepo(RepositoryResult.Success());

        // Act
        var result = await Build(userRepo).UnbanAsync(Identifier, "moderator", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        userRepo.Verify(r => r.UnbanUserAsync(Identifier, "moderator", It.IsAny<CancellationToken>()), Times.Once);
        userRepo.Verify(r => r.BanUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UnbanAsync_LogsTheModeratorWhoLiftedIt()
    {
        // Arrange
        var logger = new Mock<ILogger<AdminUserService>>();

        // Act
        await Build(UserRepo(RepositoryResult.Success()), logger.Object)
            .UnbanAsync(Identifier, "second-moderator", TestContext.Current.CancellationToken);

        // Assert
        logger.Verify(l => l.Log(
            LogLevel.Information,
            It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((state, _) => (state.ToString() ?? "").Contains("unbanned by second-moderator")),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task WhenTheUserIsUnknown_ReturnsNotFound(bool ban)
    {
        // Arrange
        var service = Build(UserRepo(RepositoryResult.NotFound()));

        // Act
        var result = ban
            ? await service.BanAsync(Identifier, "moderator", null, TestContext.Current.CancellationToken)
            : await service.UnbanAsync(Identifier, "moderator", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task BanAsync_WhenAlreadyBanned_ReturnsConflict()
    {
        // Arrange
        var userRepo = UserRepo(RepositoryResult.Conflict());

        // Act
        var result = await Build(userRepo).BanAsync(Identifier, "moderator", "spam", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task UnbanAsync_WhenNotBanned_ReturnsConflictAndLogsNothing()
    {
        // Arrange
        var logger = new Mock<ILogger<AdminUserService>>();

        // Act
        var result = await Build(UserRepo(RepositoryResult.Conflict()), logger.Object)
            .UnbanAsync(Identifier, "moderator", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        result.Message.ResultMessage.Should().Be("The user is not banned.");
        logger.Verify(l => l.Log(
            LogLevel.Information,
            It.IsAny<EventId>(),
            It.IsAny<It.IsAnyType>(),
            It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Never);
    }

    [Fact]
    public async Task BanAsync_WhenTheWriteFails_ReportsTheFailure()
    {
        // Arrange
        var userRepo = UserRepo(RepositoryResult.Error());

        // Act
        var result = await Build(userRepo).BanAsync(Identifier, "moderator", "spam", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
