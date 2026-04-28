using Core;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;
using Moq;

namespace UnitTests.ServiceTests;

public class TrailObstaclesServiceTests
{
    private const int UserId = 1;
    private const int ObstacleId = 1;
    private const int TrailId = 1;

    private TrailObstaclesService Build(
        Mock<ITrailObstacleResponseRepository>? obstacleRepo = null,
        Mock<IUserService>? userSvc = null,
        Mock<ITrailService>? trailSvc = null) =>
        new(
            (obstacleRepo ?? new Mock<ITrailObstacleResponseRepository>()).Object,
            new Mock<ILogger<TrailObstaclesService>>().Object,
            new TrailObstaclesResponseFactory(),
            (userSvc ?? Utilities.MockFactory.UserServiceFoundById(UserId)).Object,
            (trailSvc ?? Utilities.MockFactory.TrailServiceFound(TrailId)).Object);


    [Fact]
    public async Task GetObstacles_WhenObstaclesExist_ReturnsSuccess()
    {
        // Arrange
        IReadOnlyCollection<TrailObstacle> obstacles = [Utilities.Stubs.Obstacle()];
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstaclesByTrailIdentifierAsync(Utilities.Identifiers.Trail1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Success(obstacles));

        // Act
        var result = await Build(repo).GetTrailObstaclesByTrailIdentifierAsync(Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetObstacles_WhenNoneExist_ReturnsEmptyList()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstaclesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Success([]));

        // Act
        var result = await Build(repo).GetTrailObstaclesByTrailIdentifierAsync(Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstacles_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstaclesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Error());

        // Act
        var result = await Build(repo).GetTrailObstaclesByTrailIdentifierAsync(Utilities.Identifiers.Trail1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrailObstacle_WithValidData_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.AddTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));

        // Act
        var result = await Build(repo).AddTrailObstacle(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, "Big tree", "FallenTree", null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddTrailObstacle_WhenUserNotFound_Returns404()
    {
        // Arrange
        var service = Build(userSvc: Utilities.MockFactory.UserServiceNotFoundById());

        // Act
        var result = await service.AddTrailObstacle("invalid", Utilities.Identifiers.Trail1, "Desc", "FallenTree", null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailObstacle_WhenTrailNotFound_Returns404()
    {
        // Arrange
        var service = Build(trailSvc: Utilities.MockFactory.TrailServiceNotFound());

        // Act
        var result = await service.AddTrailObstacle(Utilities.Identifiers.User, "invalid", "Desc", "FallenTree", null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailObstacle_WithUnknownIssueType_DefaultsToOther()
    {
        // Arrange
        TrailObstacle? captured = null;
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.AddTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .Callback<TrailObstacle, CancellationToken>((obs, _) => captured = obs)
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));

        // Act
        await Build(repo).AddTrailObstacle(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, "Desc", "TotallyUnknown", null, null, CancellationToken.None);

        // Assert
        captured!.IssueType.Should().Be(TrailIssueType.Other);
    }

    [Fact]
    public async Task AddTrailObstacle_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.AddTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Error());

        // Act
        var result = await Build(repo).AddTrailObstacle(Utilities.Identifiers.User, Utilities.Identifiers.Trail1, "Big tree", "FallenTree", null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddSolvedVote_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var obstacle = Utilities.Stubs.Obstacle(votes: []);
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(Utilities.Identifiers.Obstacle1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.AddSolvedVoteAsync(It.IsAny<TrailObstacleSolvedVote>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).AddSolvedVoteAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddSolvedVote_WhenUserNotFound_Returns404()
    {
        // Arrange
        var service = Build(userSvc: Utilities.MockFactory.UserServiceNotFoundById());

        // Act
        var result = await service.AddSolvedVoteAsync("invalid", Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddSolvedVote_WhenObstacleNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        // Act
        var result = await Build(repo).AddSolvedVoteAsync(Utilities.Identifiers.User, "invalid-obstacle", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddSolvedVote_WhenUserAlreadyVoted_Returns409()
    {
        // Arrange
        var obstacle = Utilities.Stubs.Obstacle(votes: [new TrailObstacleSolvedVote { UserId = UserId, TrailObstacleId = ObstacleId }]);
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(Utilities.Identifiers.Obstacle1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));

        // Act
        var result = await Build(repo).AddSolvedVoteAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddSolvedVote_WhenRepositoryThrows_Returns500()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(Utilities.Identifiers.Obstacle1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle(votes: [])));
        repo.Setup(r => r.AddSolvedVoteAsync(It.IsAny<TrailObstacleSolvedVote>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).AddSolvedVoteAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenValid_ReturnsSuccess()
    {
        // Use distinct IDs so a swap of (obstacleId, userId) would cause the mock not to match
        // Arrange
        const int distinctObstacleId = 42;
        const int distinctUserId = 99;
        var obstacle = Utilities.Stubs.Obstacle();
        obstacle.Id = distinctObstacleId;
        var vote = Utilities.Stubs.Vote();

        var userSvc = new Mock<IUserService>();
        userSvc.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(distinctUserId));

        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(Utilities.Identifiers.Obstacle1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        // Pin exact argument order: (obstacleId, userId) — catches swapped IDs
        repo.Setup(r => r.GetSolvedVoteByObstacleIdAndUserIdAsync(distinctObstacleId, distinctUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacleSolvedVote>.Success(vote));
        repo.Setup(r => r.DeleteSolvedVoteAsync(vote, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, userSvc).DeleteSolvedVoteByUserIdentifierAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenUserNotFound_Returns404()
    {
        // Arrange
        var service = Build(userSvc: Utilities.MockFactory.UserServiceNotFoundById());

        // Act
        var result = await service.DeleteSolvedVoteByUserIdentifierAsync("invalid", Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenObstacleNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        // Act
        var result = await Build(repo).DeleteSolvedVoteByUserIdentifierAsync(Utilities.Identifiers.User, "invalid-obs", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenVoteNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(Utilities.Identifiers.Obstacle1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));
        repo.Setup(r => r.GetSolvedVoteByObstacleIdAndUserIdAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacleSolvedVote>.NotFound());

        // Act
        var result = await Build(repo).DeleteSolvedVoteByUserIdentifierAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenRepositoryThrows_Returns500()
    {
        // Arrange
        var vote = Utilities.Stubs.Vote();
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(Utilities.Identifiers.Obstacle1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));
        repo.Setup(r => r.GetSolvedVoteByObstacleIdAndUserIdAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacleSolvedVote>.Success(vote));
        repo.Setup(r => r.DeleteSolvedVoteAsync(vote, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).DeleteSolvedVoteByUserIdentifierAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(Utilities.Identifiers.Obstacle1, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));
        repo.Setup(r => r.UpdateTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));

        // Act
        var result = await Build(repo).UpdateTrailObstacleAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, "New description", "Mud", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenUserNotFound_Returns404()
    {
        // Arrange
        var service = Build(userSvc: Utilities.MockFactory.UserServiceNotFoundById());

        // Act
        var result = await service.UpdateTrailObstacleAsync("invalid", Utilities.Identifiers.Obstacle1, "desc", "Mud", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenObstacleNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        // Act
        var result = await Build(repo).UpdateTrailObstacleAsync(Utilities.Identifiers.User, "invalid-obs", "desc", "Mud", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WithUnknownIssueType_DoesNotChangeIssueType()
    {
        // Arrange
        var obstacle = Utilities.Stubs.Obstacle(); // IssueType = FallenTree
        TrailObstacle? captured = null;
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(Utilities.Identifiers.Obstacle1, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.UpdateTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .Callback<TrailObstacle, CancellationToken>((obs, _) => captured = obs)
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));

        // Act
        await Build(repo).UpdateTrailObstacleAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, "New desc", "TotallyUnknown", CancellationToken.None);

        // Assert
        captured!.IssueType.Should().Be(TrailIssueType.FallenTree);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenRepositoryThrows_Returns500()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(Utilities.Identifiers.Obstacle1, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(Utilities.Stubs.Obstacle()));
        repo.Setup(r => r.UpdateTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).UpdateTrailObstacleAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, "New desc", "Mud", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var obstacle = Utilities.Stubs.Obstacle();
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(Utilities.Identifiers.Obstacle1, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.DeleteTrailObstacleAsync(obstacle, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteTrailObstacleAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenUserNotFound_Returns404()
    {
        // Arrange
        var service = Build(userSvc: Utilities.MockFactory.UserServiceNotFoundById());

        // Act
        var result = await service.DeleteTrailObstacleAsync("invalid", Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenObstacleNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        // Act
        var result = await Build(repo).DeleteTrailObstacleAsync(Utilities.Identifiers.User, "invalid-obs", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenRepositoryThrows_Returns500()
    {
        // Arrange
        var obstacle = Utilities.Stubs.Obstacle();
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(Utilities.Identifiers.Obstacle1, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.DeleteTrailObstacleAsync(obstacle, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).DeleteTrailObstacleAsync(Utilities.Identifiers.User, Utilities.Identifiers.Obstacle1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
