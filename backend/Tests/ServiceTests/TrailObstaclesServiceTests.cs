using Core.Factories;
using Core.Interfaces;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace ServiceTests;

public class TrailObstaclesServiceTests : TestBase
{
    [Fact]
    public async Task GetTrailObstacles_WhenObstaclesExist_ShouldReturnObstacles()
    {
        // Arrange
        var service = CreateTrailObstacleService();
        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden — has obstacle 1

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetTrailObstacles_WhenNoObstaclesExist_ShouldReturnEmptyList()
    {
        // Arrange
        var service = CreateTrailObstacleService();
        var trailIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"; // Gesebol — no obstacles

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetTrailObstacles_ShouldNotReturnObstacles_OlderThan30Days()
    {
        // Arrange
        var service = CreateTrailObstacleService();
        var trailIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden — obstacle 1 (active) + obstacle 4 (40 days old)

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1); // Obstacle 4 filtered out
    }

    [Fact]
    public async Task GetTrailObstacles_ShouldNotReturnObstacle_WithThreeOrMoreSolvedVotes()
    {
        // Arrange
        var service = CreateTrailObstacleService();
        var trailIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Tångaleden — obstacle 3 has 3 solved votes in seed

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty(); // Obstacle 3 filtered out: 3 or more solved votes
    }

    [Fact]
    public async Task AddTrailObstacle_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddTrailObstacle(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", // NaturElskaren
            "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",  // Tiveden
            "Stort träd blockerar stigen.",
            "FallenTree",
            null, null,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddTrailObstacle_WithInvalidUserIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddTrailObstacle(
            "invalid-user",
            "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            "Beskrivning av hinder.",
            "FallenTree",
            null, null,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailObstacle_WithInvalidTrailIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddTrailObstacle(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "invalid-trail",
            "Beskrivning av hinder.",
            "FallenTree",
            null, null,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailObstacle_WithUnknownIssueType_ShouldDefaultToOther()
    {
        // Arrange
        var options = CreateSeededOptions();
        var service = CreateTrailObstacleServiceWithOptions(options);

        // Act
        var result = await service.AddTrailObstacle(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            "Okänt problem på stigen.",
            "SomethingTotallyUnknown",
            null, null,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();

        using var context = new StigViddDbContext(options);
        var saved = context.TrailObstacles.OrderByDescending(o => o.Id).First();
        saved.IssueType.Should().Be(TrailIssueType.Other);
    }

    [Fact]
    public async Task AddTrailObstacle_WithCoordinates_ShouldPersistCoordinates()
    {
        // Arrange
        var options = CreateSeededOptions();
        var service = CreateTrailObstacleServiceWithOptions(options);

        // Act
        var result = await service.AddTrailObstacle(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            "Stort träd blockerar stigen.",
            "FallenTree",
            12.8382551042M, 57.7291353665M,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();

        using var context = new StigViddDbContext(options);
        var saved = context.TrailObstacles.OrderByDescending(o => o.Id).First();
        saved.IncidentLongitude.Should().Be(12.8382551042M);
        saved.IncidentLatitude.Should().Be(57.7291353665M);
    }

    [Fact]
    public async Task AddSolvedVote_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddSolvedVoteAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", // VandrarVennen — has not voted on obstacle 1
            "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",  // Obstacle 1 — 0 votes
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddSolvedVote_WhenUserAlreadyVoted_ShouldReturnConflict()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddSolvedVoteAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", // NaturElskaren — already voted on obstacle 2
            "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task AddSolvedVote_WithInvalidUserIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddSolvedVoteAsync(
            "invalid-user",
            "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddSolvedVote_WithInvalidObstacleIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddSolvedVoteAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "invalid-obstacle",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.DeleteSolvedVoteByUserIdentifierAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", // NaturElskaren — has a vote on obstacle 2
            "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteSolvedVote_WithInvalidUserIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.DeleteSolvedVoteByUserIdentifierAsync(
            "invalid-user",
            "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WithInvalidObstacleIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.DeleteSolvedVoteByUserIdentifierAsync(
            "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "invalid-obstacle",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteSolvedVote_WhenUserHasNoVoteOnObstacle_ShouldReturnNotFound()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.DeleteSolvedVoteByUserIdentifierAsync(
            "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67", // SkogsGreven — has no vote on obstacle 2
            "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    private TrailObstaclesService CreateTrailObstacleService()
    {
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => CreateContextAndSqliteDb());

        return BuildService(mockContextFactory.Object);
    }

    private TrailObstaclesService CreateTrailObstacleServiceWithOptions(DbContextOptions<StigViddDbContext> options)
    {
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));

        return BuildService(mockContextFactory.Object);
    }

    private TrailObstaclesService BuildService(IDbContextFactory<StigViddDbContext> contextFactory)
    {
        var userService = new UserService(
            contextFactory,
            new Mock<ILogger<UserService>>().Object,
            new Mock<IFirebaseAuthService>().Object,
            new UserFavoritesResponseFactory(),
            new UserWishlistResponseFactory(),
            new UserResponseFactory()
        );

        var mockConfiguration = new Mock<IConfiguration>();
        mockConfiguration.Setup(config => config["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        var trailService = new TrailService(
            contextFactory,
            new Mock<IWebDavService>().Object,
            new Mock<ILogger<TrailService>>().Object,
            new TrailResponseFactory(mockConfiguration.Object),
            mockConfiguration.Object
        );

        return new TrailObstaclesService(
            contextFactory,
            new Mock<ILogger<TrailObstaclesService>>().Object,
            new TrailObstaclesResponseFactory(),
            userService,
            trailService
        );
    }
}
