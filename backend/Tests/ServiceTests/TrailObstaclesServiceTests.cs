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
    #region Seed identifiers

    // Users
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // User 1
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";  // User 2
    private const string SkogsGrenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";     // User 3

    // Trails
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";        // has Obstacle1 + Obstacle4 (old)
    private const string TangaledenIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";    // has Obstacle3 (3 solved votes)
    private const string GesebolIdentifier = "55e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";       // no obstacles

    // Obstacles
    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // Tiveden, 0 solved votes
    private const string Obstacle2Identifier = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // Storsjöleden, 1 solved vote by NaturElskaren
    private const string Obstacle3Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // Tångaleden, 3 solved votes (filtered)

    // Coordinates
    private const decimal ObstacleLatitude = 57.7291353665M;
    private const decimal ObstacleLongitude = 12.8382551042M;

    #endregion

    [Fact]
    public async Task GetTrailObstacles_WhenObstaclesExist_ShouldReturnObstacles()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, CancellationToken.None);

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

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(GesebolIdentifier, CancellationToken.None);

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

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1); // Obstacle4 (40 days old) filtered out
    }

    [Fact]
    public async Task GetTrailObstacles_ShouldNotReturnObstacle_WithThreeOrMoreSolvedVotes()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.GetTrailObstaclesByTrailIdentifierAsync(TangaledenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty(); // Obstacle3 filtered out: 3 or more solved votes
    }

    [Fact]
    public async Task AddTrailObstacle_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddTrailObstacle(
            NaturElskarenIdentifier,
            TivedenIdentifier,
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
            TivedenIdentifier,
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
            NaturElskarenIdentifier,
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
            NaturElskarenIdentifier,
            TivedenIdentifier,
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
            NaturElskarenIdentifier,
            TivedenIdentifier,
            "Stort träd blockerar stigen.",
            "FallenTree",
            ObstacleLongitude, ObstacleLatitude,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();

        using var context = new StigViddDbContext(options);
        var saved = context.TrailObstacles.OrderByDescending(o => o.Id).First();
        saved.IncidentLongitude.Should().Be(ObstacleLongitude);
        saved.IncidentLatitude.Should().Be(ObstacleLatitude);
    }

    [Fact]
    public async Task AddSolvedVote_WithValidData_ShouldReturnSuccess()
    {
        // Arrange
        var service = CreateTrailObstacleService();

        // Act
        var result = await service.AddSolvedVoteAsync(
            VandrarVennenIdentifier, // VandrarVennen has not voted on Obstacle1
            Obstacle1Identifier,
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
            NaturElskarenIdentifier, // NaturElskaren already voted on Obstacle2
            Obstacle2Identifier,
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
            Obstacle1Identifier,
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
            NaturElskarenIdentifier,
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
            NaturElskarenIdentifier, // NaturElskaren has a vote on Obstacle2
            Obstacle2Identifier,
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
            Obstacle2Identifier,
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
            NaturElskarenIdentifier,
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
            SkogsGrenIdentifier, // SkogsGren has no vote on Obstacle2
            Obstacle2Identifier,
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
