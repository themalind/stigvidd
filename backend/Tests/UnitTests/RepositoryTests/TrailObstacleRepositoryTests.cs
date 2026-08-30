// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class TrailObstacleRepositoryTests : TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";   // has Obstacle1 (active) + Obstacle4 (40 days old)
    private const string TangaledenIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // has Obstacle3 (3 solved votes)
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";   // no obstacles

    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden, 0 votes, userId=1
    private const string Obstacle2Identifier = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Storsjöleden, userId=2, 1 vote
    private const string Obstacle4Identifier = "ob4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"; // Tiveden, 40 days old (filtered)
    private const string OtherObstacleIdentifier = "ob5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"; // added per test, IssueType.Other

    private const string Obstacle3Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Tångaleden, 3 solved votes (expired)

    private const int UserId1 = 1;
    private const int ObstacleId2 = 2;
    private const int ObstacleId3 = 3;

    // Empty configuration: the tests assert on the retention defaults, 30 days and 3 votes.
    private static TrailObstacleRepository BuildRepo(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<TrailObstacleRepository>.Instance, new ConfigurationBuilder().Build());

    private static IDbContextFactory<StigViddDbContext> CreateFactoryWithObstacleAt(DateTime createdAt)
    {
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using var ctx = new StigViddDbContext(options);
        ctx.Trails.Add(new Trail { Id = 10, Identifier = TivedenIdentifier, Name = "Test", TrailLength = 5, City = "Test" });
        ctx.Users.Add(new User { Id = 10, Identifier = "test-user", Email = "test@test.com", NickName = "Test", SubjectId = "uid" });
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
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, to => to.Identifier, CancellationToken.None);

        // Assert
        result.Value.Should().NotContain(Obstacle4Identifier);
    }

    [Fact]
    public async Task GetObstaclesByTrail_FiltersObstaclesWithThreeOrMoreSolvedVotes()
    {
        // Arrange
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-30)));

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
        var repo = BuildRepo(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-29)));

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
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailObstacleByIdentifierAndUserIdAsync(Obstacle1Identifier, UserId1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetObstacleByIdentifierAndUserId_WhenWrongUser_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(factory);
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
        var repo = BuildRepo(factory);
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
        var repo = BuildRepo(factory);
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
        var repo = BuildRepo(factory);
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
        var repo = BuildRepo(factory);
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
        var repo = BuildRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetSolvedVoteByObstacleIdAndUserId_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = BuildRepo(CreateSeededFactory());

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
        var repo = BuildRepo(factory);
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
        var repo = BuildRepo(factory);
        var vote = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        vote.IsSuccess.Should().BeTrue();

        // Act
        vote.Value.Should().NotBeNull();
        await repo.DeleteSolvedVoteAsync(vote.Value, CancellationToken.None);

        // Assert
        var verify = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteExpiredObstacles_RemovesTheRowsThatAreNoLongerShown()
    {
        // Arrange — Obstacle4 is 40 days old and Obstacle3 has 3 solved votes; both are expired
        var factory = CreateSeededFactory();
        var repo = BuildRepo(factory);

        // Act
        var result = await repo.DeleteExpiredObstaclesAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(2);

        var expiredByAge = await repo.GetTrailObstacleByIdentifierAsync(Obstacle4Identifier, CancellationToken.None);
        expiredByAge.IsSuccess.Should().BeFalse();

        var expiredByVotes = await repo.GetTrailObstacleByIdentifierAsync(Obstacle3Identifier, CancellationToken.None);
        expiredByVotes.IsSuccess.Should().BeFalse();

        var stillActive = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        stillActive.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteExpiredObstacles_TakesTheSolvedVotesWithIt()
    {
        // Arrange — Obstacle3 carries the three votes that expired it
        var factory = CreateSeededFactory();
        var repo = BuildRepo(factory);

        // Act
        var result = await repo.DeleteExpiredObstaclesAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(CancellationToken.None);
        context.TrailObstacleSolvedVotes.Should().NotContain(sv => sv.TrailObstacleId == ObstacleId3);

        // The vote on the still-active Obstacle2 is untouched
        context.TrailObstacleSolvedVotes.Should().Contain(sv => sv.TrailObstacleId == ObstacleId2);
    }

    [Fact]
    public async Task DeleteExpiredObstacles_WhenNothingHasExpired_ReturnsZero()
    {
        // Arrange — a single obstacle one day short of the retention period
        var repo = BuildRepo(CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-29)));

        // Act
        var result = await repo.DeleteExpiredObstaclesAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(0);
    }

    [Fact]
    public async Task DeleteExpiredObstacles_DeletesExactlyWhatTheTrailViewStopsShowing()
    {
        // Arrange — an obstacle exactly at the boundary must be hidden and deleted the same day
        var factory = CreateFactoryWithObstacleAt(DateTime.UtcNow.AddDays(-30));
        var repo = BuildRepo(factory);
        var shown = await repo.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, to => to.Identifier, CancellationToken.None);
        shown.Value.Should().BeEmpty();

        // Act
        var result = await repo.DeleteExpiredObstaclesAsync(CancellationToken.None);

        // Assert
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task AnonymizeObstaclesByUserId_ClearsTheDescriptionExceptForOther()
    {
        // Arrange — user 1 owns Obstacle1 (FallenTree) plus an Other report added here
        var factory = CreateSeededFactory(ctx => ctx.TrailObstacles.Add(new TrailObstacle
        {
            Id = 100,
            Identifier = OtherObstacleIdentifier,
            Description = "Vägen är avstängd av en markägare som satt upp en kedja.",
            IssueType = TrailIssueType.Other,
            TrailId = 1,
            UserId = UserId1,
            CreatedAt = DateTime.UtcNow.AddDays(-3),
            LastUpdatedAt = DateTime.UtcNow.AddDays(-3)
        }));
        var repo = BuildRepo(factory);
        var otherBefore = await repo.GetTrailObstacleByIdentifierAsync(OtherObstacleIdentifier, CancellationToken.None);

        // Act
        var result = await repo.AnonymizeObstaclesByUserIdAsync(UserId1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var categorized = await repo.GetTrailObstacleByIdentifierAsync(Obstacle1Identifier, CancellationToken.None);
        categorized.IsSuccess.Should().BeTrue();
        categorized.Value!.Description.Should().BeEmpty();
        categorized.Value.IssueType.Should().Be(TrailIssueType.FallenTree);

        // Other keeps its description
        var other = await repo.GetTrailObstacleByIdentifierAsync(OtherObstacleIdentifier, CancellationToken.None);
        other.IsSuccess.Should().BeTrue();
        other.Value!.Description.Should().Be(otherBefore.Value!.Description);
    }

    [Fact]
    public async Task AnonymizeObstaclesByUserId_LeavesOtherUsersObstaclesAndTheirVotesAlone()
    {
        // Arrange — Obstacle2 belongs to user 2 and carries a solved vote from user 1
        var factory = CreateSeededFactory();
        var repo = BuildRepo(factory);
        var before = await repo.GetTrailObstacleByIdentifierAsync(Obstacle2Identifier, CancellationToken.None);

        // Act
        var result = await repo.AnonymizeObstaclesByUserIdAsync(UserId1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var untouched = await repo.GetTrailObstacleByIdentifierAsync(Obstacle2Identifier, CancellationToken.None);
        untouched.Value!.Description.Should().Be(before.Value!.Description);

        var vote = await repo.GetSolvedVoteByObstacleIdAndUserIdAsync(ObstacleId2, UserId1, CancellationToken.None);
        vote.IsSuccess.Should().BeTrue();
    }
}
