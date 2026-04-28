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

namespace UnitTests;

public class TrailObstaclesServiceTests
{
    private const string UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string TrailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string ObstacleIdentifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
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
            (userSvc ?? UserFound()).Object,
            (trailSvc ?? TrailFound()).Object);

    private static Mock<IUserService> UserFound()
    {
        var m = new Mock<IUserService>();
        m.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(UserId));
        return m;
    }

    private static Mock<IUserService> UserNotFound()
    {
        var m = new Mock<IUserService>();
        m.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<int>(new Message(404, "User not found")));
        return m;
    }

    private static Mock<ITrailService> TrailFound()
    {
        var m = new Mock<ITrailService>();
        m.Setup(t => t.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(TrailId));
        return m;
    }

    private static Mock<ITrailService> TrailNotFound()
    {
        var m = new Mock<ITrailService>();
        m.Setup(t => t.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<int>(new Message(404, "Trail not found")));
        return m;
    }

    private static TrailObstacle StubObstacle(List<TrailObstacleSolvedVote>? votes = null) => new()
    {
        Id = ObstacleId,
        Identifier = ObstacleIdentifier,
        Description = "Fallen tree",
        IssueType = TrailIssueType.FallenTree,
        TrailId = TrailId,
        UserId = UserId,
        User = new User { Id = UserId, Identifier = UserIdentifier, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" },
        SolvedVotes = votes ?? []
    };

    private static TrailObstacleSolvedVote StubVote() => new()
    {
        Id = 1,
        Identifier = "vote-1",
        TrailObstacleId = ObstacleId,
        UserId = UserId,
        User = new User { Id = UserId, Identifier = UserIdentifier, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" }
    };


    [Fact]
    public async Task GetObstacles_WhenObstaclesExist_ReturnsSuccess()
    {
        IReadOnlyCollection<TrailObstacle> obstacles = [StubObstacle()];
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstaclesByTrailIdentifierAsync(TrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Success(obstacles));

        var result = await Build(repo).GetTrailObstaclesByTrailIdentifierAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetObstacles_WhenNoneExist_ReturnsEmptyList()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstaclesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Success([]));

        var result = await Build(repo).GetTrailObstaclesByTrailIdentifierAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstacles_WhenRepositoryFails_Returns500()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstaclesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailObstacle>>.Error());

        var result = await Build(repo).GetTrailObstaclesByTrailIdentifierAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task AddTrailObstacle_WithValidData_ReturnsSuccess()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.AddTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));

        var result = await Build(repo).AddTrailObstacle(UserIdentifier, TrailIdentifier, "Big tree", "FallenTree", null, null, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddTrailObstacle_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).AddTrailObstacle("invalid", TrailIdentifier, "Desc", "FallenTree", null, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailObstacle_WhenTrailNotFound_Returns404()
    {
        var result = await Build(trailSvc: TrailNotFound()).AddTrailObstacle(UserIdentifier, "invalid", "Desc", "FallenTree", null, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailObstacle_WithUnknownIssueType_DefaultsToOther()
    {
        TrailObstacle? captured = null;
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.AddTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .Callback<TrailObstacle, CancellationToken>((obs, _) => captured = obs)
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));

        await Build(repo).AddTrailObstacle(UserIdentifier, TrailIdentifier, "Desc", "TotallyUnknown", null, null, CancellationToken.None);

        captured!.IssueType.Should().Be(TrailIssueType.Other);
    }

    [Fact]
    public async Task AddTrailObstacle_WhenRepositoryFails_Returns500()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.AddTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Error());

        var result = await Build(repo).AddTrailObstacle(UserIdentifier, TrailIdentifier, "Big tree", "FallenTree", null, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task AddSolvedVote_WhenValid_ReturnsSuccess()
    {
        var obstacle = StubObstacle(votes: []); // user has not yet voted
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(ObstacleIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.AddSolvedVoteAsync(It.IsAny<TrailObstacleSolvedVote>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo).AddSolvedVoteAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddSolvedVote_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).AddSolvedVoteAsync("invalid", ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddSolvedVote_WhenObstacleNotFound_Returns404()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        var result = await Build(repo).AddSolvedVoteAsync(UserIdentifier, "invalid-obstacle", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddSolvedVote_WhenUserAlreadyVoted_Returns409()
    {
        var obstacle = StubObstacle(votes: [new TrailObstacleSolvedVote { UserId = UserId, TrailObstacleId = ObstacleId }]);
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(ObstacleIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));

        var result = await Build(repo).AddSolvedVoteAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddSolvedVote_WhenRepositoryThrows_Returns500()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(ObstacleIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle(votes: [])));
        repo.Setup(r => r.AddSolvedVoteAsync(It.IsAny<TrailObstacleSolvedVote>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).AddSolvedVoteAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task DeleteSolvedVote_WhenValid_ReturnsSuccess()
    {
        // Use distinct IDs so a swap of (obstacleId, userId) would cause the mock not to match
        const int distinctObstacleId = 42;
        const int distinctUserId = 99;
        var obstacle = StubObstacle();
        obstacle.Id = distinctObstacleId;
        var vote = StubVote();

        var userSvc = new Mock<IUserService>();
        userSvc.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(distinctUserId));

        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(ObstacleIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        // Pin exact argument order: (obstacleId, userId) — catches swapped IDs
        repo.Setup(r => r.GetSolvedVoteByObstacleIdAndUserIdAsync(distinctObstacleId, distinctUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacleSolvedVote>.Success(vote));
        repo.Setup(r => r.DeleteSolvedVoteAsync(vote, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo, userSvc).DeleteSolvedVoteByUserIdentifierAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).DeleteSolvedVoteByUserIdentifierAsync("invalid", ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenObstacleNotFound_Returns404()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        var result = await Build(repo).DeleteSolvedVoteByUserIdentifierAsync(UserIdentifier, "invalid-obs", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenVoteNotFound_Returns404()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(ObstacleIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));
        repo.Setup(r => r.GetSolvedVoteByObstacleIdAndUserIdAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacleSolvedVote>.NotFound());

        var result = await Build(repo).DeleteSolvedVoteByUserIdentifierAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenRepositoryThrows_Returns500()
    {
        var vote = StubVote();
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAsync(ObstacleIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));
        repo.Setup(r => r.GetSolvedVoteByObstacleIdAndUserIdAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacleSolvedVote>.Success(vote));
        repo.Setup(r => r.DeleteSolvedVoteAsync(vote, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).DeleteSolvedVoteByUserIdentifierAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task UpdateTrailObstacle_WhenValid_ReturnsSuccess()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(ObstacleIdentifier, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));
        repo.Setup(r => r.UpdateTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));

        var result = await Build(repo).UpdateTrailObstacleAsync(UserIdentifier, ObstacleIdentifier, "New description", "Mud", CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).UpdateTrailObstacleAsync("invalid", ObstacleIdentifier, "desc", "Mud", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenObstacleNotFound_Returns404()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        var result = await Build(repo).UpdateTrailObstacleAsync(UserIdentifier, "invalid-obs", "desc", "Mud", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WithUnknownIssueType_DoesNotChangeIssueType()
    {
        var obstacle = StubObstacle(); // IssueType = FallenTree
        TrailObstacle? captured = null;
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(ObstacleIdentifier, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.UpdateTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .Callback<TrailObstacle, CancellationToken>((obs, _) => captured = obs)
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));

        await Build(repo).UpdateTrailObstacleAsync(UserIdentifier, ObstacleIdentifier, "New desc", "TotallyUnknown", CancellationToken.None);

        captured!.IssueType.Should().Be(TrailIssueType.FallenTree);
    }

    [Fact]
    public async Task UpdateTrailObstacle_WhenRepositoryThrows_Returns500()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(ObstacleIdentifier, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(StubObstacle()));
        repo.Setup(r => r.UpdateTrailObstacleAsync(It.IsAny<TrailObstacle>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).UpdateTrailObstacleAsync(UserIdentifier, ObstacleIdentifier, "New desc", "Mud", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task DeleteTrailObstacle_WhenValid_ReturnsSuccess()
    {
        var obstacle = StubObstacle();
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(ObstacleIdentifier, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.DeleteTrailObstacleAsync(obstacle, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo).DeleteTrailObstacleAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).DeleteTrailObstacleAsync("invalid", ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenObstacleNotFound_Returns404()
    {
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.NotFound());

        var result = await Build(repo).DeleteTrailObstacleAsync(UserIdentifier, "invalid-obs", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteTrailObstacle_WhenRepositoryThrows_Returns500()
    {
        var obstacle = StubObstacle();
        var repo = new Mock<ITrailObstacleResponseRepository>();
        repo.Setup(r => r.GetTrailObstacleByIdentifierAndUserIdAsync(ObstacleIdentifier, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailObstacle>.Success(obstacle));
        repo.Setup(r => r.DeleteTrailObstacleAsync(obstacle, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).DeleteTrailObstacleAsync(UserIdentifier, ObstacleIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }
}
