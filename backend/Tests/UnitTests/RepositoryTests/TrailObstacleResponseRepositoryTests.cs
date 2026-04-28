using Core;
using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace RepositoryTests;

public class TrailObstacleResponseRepositoryTests : UnitTests.TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";   // has Obstacle1 (active) + Obstacle4 (40 days old)
    private const string TangaledenIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // has Obstacle3 (3 solved votes)
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";   // no obstacles

    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden, 0 votes, userId=1
    private const string Obstacle2Identifier = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Storsjöleden, 1 vote by user 1

    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // has Obstacle2 (1 solved vote)
    private const int UserId1 = 1;
    private const int ObstacleId2 = 2;

    private static IDbContextFactory<StigViddDbContext> CreateFactoryWithObstacleAt(DateTime createdAt)
    {
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var ctx = new StigViddDbContext(options);
        ctx.Trails.Add(new Trail { Id = 10, Identifier = TivedenIdentifier, Name = "Test", TrailLength = 5, City = "Test" });
        ctx.Users.Add(new User { Id = 10, Identifier = "test-user", Email = "test@test.com", NickName = "Test", FirebaseUid = "uid" });
        ctx.TrailObstacles.Add(new TrailObstacle
        {
            Id = 10,
            Identifier = "boundary-obstacle",
            Description = "Boundary obstacle",
            IssueType = TrailIssueType.Mud,
            TrailId = 10,
            UserId = 10,
            CreatedAt = createdAt,
            LastUpdatedAt = createdAt
        });
        ctx.SaveChanges();

        var mock = new Mock<IDbContextFactory<StigViddDbContext>>();
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));
        return mock.Object;
    }


    [Fact]
    public async Task GetObstaclesByTrail_WhenObstaclesExist_ReturnsActiveOnes()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1); // Obstacle4 (40 days old) is filtered out
    }

    [Fact]
    public async Task GetObstaclesByTrail_WhenNoObstacles_ReturnsEmpty()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(GesebolIdentifier, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstaclesByTrail_FiltersObstaclesOlderThan30Days()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        result.Value.Should().NotContain(o => o.Identifier.Contains("ob4"));
    }

    [Fact]
    public async Task GetObstaclesByTrail_FiltersObstaclesWithThreeOrMoreSolvedVotes()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        // Obstacle3 on Tångaleden has exactly 3 solved votes
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TangaledenIdentifier, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstaclesByTrail_ObstacleExactly30DaysOld_IsExcluded()
    {
        var repo = new TrailObstacleResponseRepository(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-30)));

        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstaclesByTrail_ObstacleJustUnder30DaysOld_IsIncluded()
    {
        var repo = new TrailObstacleResponseRepository(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-29)));

        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }


    [Fact]
    public async Task GetObstacleByIdentifier_WhenFound_ReturnsSuccess()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Identifier.Should().Be(Obstacle1Identifier);
    }

    [Fact]
    public async Task GetObstacleByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstacleByIdentifierAsync("no-such-obstacle", CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }


    [Fact]
    public async Task GetObstacleByIdentifierAndUserId_WhenFound_ReturnsSuccess()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstacleByIdentifierAndUserIdAsync(Obstacle1Identifier, UserId1, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetObstacleByIdentifierAndUserId_WhenWrongUser_ReturnsNotFound()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetTrailObstacleByIdentifierAndUserIdAsync(Obstacle1Identifier, 99, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }


    [Fact]
    public async Task AddTrailObstacle_ShouldPersistAndReturn()
    {
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleResponseRepository(factory);

        var obstacle = new TrailObstacle
        {
            Identifier = Guid.NewGuid().ToString(),
            Description = "New obstacle",
            IssueType = TrailIssueType.Mud,
            TrailId = 1,
            UserId = 1
        };

        var result = await repo.AddTrailObstacleAsync(obstacle, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Description.Should().Be("New obstacle");

        var verify = await repo.GetTrailObstacleByIdentifierAsync(obstacle.Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }


    [Fact]
    public async Task UpdateTrailObstacle_ShouldPersistChanges()
    {
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleResponseRepository(factory);

        var found = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        var obstacle = found.Value!;
        obstacle.Description = "Updated description";
        obstacle.IssueType = TrailIssueType.Flooding;

        await repo.UpdateTrailObstacleAsync(obstacle, CancellationToken.None);

        var verify = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        verify.Value!.Description.Should().Be("Updated description");
        verify.Value.IssueType.Should().Be(TrailIssueType.Flooding);
    }


    [Fact]
    public async Task DeleteTrailObstacle_ShouldRemoveFromDatabase()
    {
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleResponseRepository(factory);

        var found = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        await repo.DeleteTrailObstacleAsync(found.Value!, CancellationToken.None);

        var verify = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }


    [Fact]
    public async Task GetSolvedVoteByObstacleIdAndUserId_WhenFound_ReturnsSuccess()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetSolvedVoteByObstacleIdAndUserId_WhenNotFound_ReturnsNotFound()
    {
        var repo = new TrailObstacleResponseRepository(CreateSeededFactory());

        var result = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(99, 99, CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddSolvedVote_ShouldPersist()
    {
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleResponseRepository(factory);

        var vote = new TrailObstacleSolvedVote
        {
            Identifier = Guid.NewGuid().ToString(),
            TrailObstacleId = 1,
            UserId = 2
        };

        var addResult = await repo.AddSolvedVoteAsync(vote, CancellationToken.None);
        addResult.IsSuccess.Should().BeTrue();

        var verify = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(1, 2, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSolvedVote_ShouldRemove()
    {
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleResponseRepository(factory);

        var vote = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        vote.IsSuccess.Should().BeTrue();

        await repo.DeleteSolvedVoteAsync(vote.Value!, CancellationToken.None);

        var verify = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }
}
