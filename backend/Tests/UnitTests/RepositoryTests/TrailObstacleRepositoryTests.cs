using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class TrailObstacleRepositoryTests : TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";   // has Obstacle1 (active) + Obstacle4 (40 days old)
    private const string TangaledenIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // has Obstacle3 (3 solved votes)
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";   // no obstacles

    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden, 0 votes, userId=1
    private const string Obstacle4Identifier = "ob4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"; // Tiveden, 40 days old (filtered)

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
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1); // Obstacle4 (40 days old) is filtered out
    }

    [Fact]
    public async Task GetObstaclesByTrail_WhenNoObstacles_ReturnsEmpty()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(GesebolIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstaclesByTrail_FiltersObstaclesOlderThan30Days()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.Value.Should().NotContain(Obstacle4Identifier);
    }

    [Fact]
    public async Task GetObstaclesByTrail_FiltersObstaclesWithThreeOrMoreSolvedVotes()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        // Obstacle3 on Tångaleden has exactly 3 solved votes
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TangaledenIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstaclesByTrail_ObstacleExactly30DaysOld_IsExcluded()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-30)), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetObstaclesByTrail_ObstacleJustUnder30DaysOld_IsIncluded()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-29)), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetObstacleByIdentifier_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Obstacle1Identifier);
    }

    [Fact]
    public async Task GetObstacleByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstacleByIdentifierAsync("no-such-obstacle", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetObstacleByIdentifierAndUserId_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstacleByIdentifierAndUserIdAsync(Obstacle1Identifier, UserId1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetObstacleByIdentifierAndUserId_WhenWrongUser_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetTrailObstacleByIdentifierAndUserIdAsync(Obstacle1Identifier, 99, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddTrailObstacle_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var obstacle = new TrailObstacle
        {
            Identifier = Guid.NewGuid().ToString(),
            Description = "New obstacle",
            IssueType = TrailIssueType.Mud,
            TrailId = 1,
            UserId = 1
        };

        // Act
        var result = await repo.AddTrailObstacleAsync(obstacle, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Description.Should().Be("New obstacle");

        var verify = await repo.GetTrailObstacleByIdentifierAsync(obstacle.Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateTrailObstacle_ShouldPersistChanges()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var found = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();
        found.Value.Should().NotBeNull();
        var obstacle = found.Value;
        obstacle.Description = "Updated description";
        obstacle.IssueType = TrailIssueType.Flooding;

        // Act
        await repo.UpdateTrailObstacleAsync(obstacle, CancellationToken.None);

        // Assert
        var verify = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        verify.Value.Should().NotBeNull();
        verify.Value.Description.Should().Be("Updated description");
        verify.Value.IssueType.Should().Be(TrailIssueType.Flooding);
    }

    [Fact]
    public async Task UpdateTrailObstacle_SetsLastUpdatedAtToUtcNow()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var found = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        var obstacle = found.Value;
        obstacle.Should().NotBeNull();

        var before = DateTime.UtcNow;

        // Act
        await repo.UpdateTrailObstacleAsync(obstacle, CancellationToken.None);
        var after = DateTime.UtcNow;

        // Assert
        var persisted = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        persisted.IsSuccess.Should().BeTrue();

        var persistedValue = persisted.Value;
        persistedValue.Should().NotBeNull();
        persistedValue.LastUpdatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public async Task UpdateTrailObstacle_OverwritesPreviousLastUpdatedAt()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var found = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        var obstacle = found.Value;
        obstacle.Should().NotBeNull();

        var originalLastUpdatedAt = obstacle.LastUpdatedAt;

        // Act
        await repo.UpdateTrailObstacleAsync(obstacle, CancellationToken.None);

        // Assert
        var persisted = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        persisted.IsSuccess.Should().BeTrue();

        var persistedValue = persisted.Value;
        persistedValue.Should().NotBeNull();
        persistedValue.LastUpdatedAt.Should().NotBe(originalLastUpdatedAt);
    }

    [Fact]
    public async Task DeleteTrailObstacle_ShouldRemoveFromDatabase()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var found = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);

        // Act
        found.Value.Should().NotBeNull();
        await repo.DeleteTrailObstacleAsync(found.Value, CancellationToken.None);

        // Assert
        var verify = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task GetSolvedVoteByObstacleIdAndUserId_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetSolvedVoteByObstacleIdAndUserId_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailObstacleRepository(CreateSeededFactory(), NullLogger<TrailObstacleRepository>.Instance);

        // Act
        var result = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(99, 99, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddSolvedVote_ShouldPersist()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var vote = new TrailObstacleSolvedVote
        {
            Identifier = Guid.NewGuid().ToString(),
            TrailObstacleId = 1,
            UserId = 2
        };

        // Act
        var addResult = await repo.AddSolvedVoteAsync(vote, CancellationToken.None);

        // Assert
        addResult.IsSuccess.Should().BeTrue();

        var verify = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(1, 2, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSolvedVote_ShouldRemove()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailObstacleRepository(factory, NullLogger<TrailObstacleRepository>.Instance);
        var vote = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        vote.IsSuccess.Should().BeTrue();

        // Act
        vote.Value.Should().NotBeNull();
        await repo.DeleteSolvedVoteAsync(vote.Value, CancellationToken.None);

        // Assert
        var verify = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }
}
