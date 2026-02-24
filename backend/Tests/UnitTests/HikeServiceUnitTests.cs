using Core.Factories;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using WebDataContracts.RequestModels.Hike;

namespace UnitTests;

public class HikeServiceTests
{
    [Fact]
    public async Task CreateHikeAsync_ShouldCreateHike_WhenUserExists()
    {
        // Arrange
        var service = CreateHikeService();

        var request = new CreateHikeRequest
        {
            Name = "NewHike",
            HikeLength = 5000,
            Duration = 1800000,
            Coordinates = "[]"
        };

        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var result = await service.CreateHikeAsync(
            request,
            userIdentifier,
            CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("NewHike");
        result.Value.HikeLength.Should().Be(5);
    }

    [Fact]
    public async Task CreateHikeAsync_ShouldFail_WhenUserDoesNotExist()
    {
        // Arrange
        var service = CreateHikeService();

        var request = new CreateHikeRequest
        {
            Name = "NewHike",
            HikeLength = 5000,
            Duration = 1800000,
            Coordinates = "[]"
        };

        var userIdentifier = "not a guid";

        // Act
        var result = await service.CreateHikeAsync(
            request,
            userIdentifier,
            CancellationToken.None
        );

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message!.ResultMessage.Should().Be("User not found");
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldReturnHike_WhenExists()
    {        
        // Arrange
        var service = CreateHikeService();

        var identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";

        // Act
        var result = await service.GetHikeByIdentifierAsync(identifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("TestHike1");
        result.Value.HikeLength.Should().Be(10);
        result.Value.CreatedBy.Should().Be("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
    }

    [Fact]
    public async Task GetHikeByIdentifierAsync_ShouldFail_WhenIdentifierDoNotExists()
    {        
        // Arrange
        var service = CreateHikeService();

        var identifier = "not a guid";

        // Act
        var result = await service.GetHikeByIdentifierAsync(identifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message!.ResultMessage.Should().Be("Hike not found");
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnAllHikes_WhenNoQueryIsPresent()
    {
        // Arrange
        var service = CreateHikeService();

        // Act
        var result = await service.GetHikesAsync(string.Empty, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().HaveCount(5);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnCorrectHikes_WhenQueriedUserHasHikes()
    {
        // Arrange
        var service = CreateHikeService();
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

        // Act
        var result = await service.GetHikesAsync(
            userIdentifier,
            CancellationToken.None
        );

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().HaveCount(2);
        result.Value.First().CreatedBy.Should().Be(userIdentifier);
    }

    [Fact]
    public async Task GetHikesAsync_ShouldReturnEmptyList_WhenQueriedUserHasNoHikes()
    {
        // Arrange
        var service = CreateHikeService();
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22";

        // Act
        var result = await service.GetHikesAsync(
            userIdentifier,
            CancellationToken.None
        );

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().HaveCount(0);
    }

    [Fact]
    public async Task DeleteHikeAsync_ShouldDeleteHike_WhenIdentifiersMatch()
    {
        // Arrange
        // Not using CreateHikeService() or CreateContextAndSqliteDb() to keep connection open in order to verify deletion.
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open(); 

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseSqlite(connection)
            .Options;

        var context = new StigViddDbContext(options);
        context.Database.EnsureCreated();
        Utilities.InitializeDbForTests(context);

        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));
        
        var service = new HikeService(
            mockContextFactory.Object,
            new HikeResponseFactory(),
            new Mock<ILogger<HikeService>>().Object
        );

        var hikeIdentifier = "7a1e9c3d-2b4f-4d68-8c0a-5f2b7e1d9c32";
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";

        // Act
        var result = await service.DeleteHikeAsync(
            hikeIdentifier,
            userIdentifier,
            CancellationToken.None
        );

        // Assert
        result.Success.Should().BeTrue();

        using var verifyContext = new StigViddDbContext(options);

        verifyContext.Hikes.Any(h => h.Identifier == hikeIdentifier)
            .Should().BeFalse();
    }

    [Theory]
    [InlineData("3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90","b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22")]
    [InlineData("b7a2d4c1-5e9f-4a63-8c1d-0f2e7b9a6c34","b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22")]
    [InlineData("91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13","b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d22")]
    public async Task DeleteHikeAsync_ShouldFail_WhenIdentifiersDoesNotMatch(string hikeIdentifier, string userIdentifier)
    {
        // Arrange
        var service = CreateHikeService();

        // Act
        var result = await service.DeleteHikeAsync(
            hikeIdentifier,
            userIdentifier,
            CancellationToken.None
        );

        // Assert
        result.Success.Should().BeFalse();
    }

    private HikeService CreateHikeService()
    {
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => CreateContextAndSqliteDb());
        
        var HikeResponseFactory = new HikeResponseFactory();
        var mockLogger = new Mock<ILogger<HikeService>>();
        
        var service = new HikeService(
            mockContextFactory.Object,
            HikeResponseFactory,
            mockLogger.Object
        );

        return service;
    }

    private StigViddDbContext CreateContextAndSqliteDb()
    {       
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open(); 

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseSqlite(connection)
            .Options;

        var context = new StigViddDbContext(options);

        context.Database.EnsureCreated();

        Utilities.InitializeDbForTests(context);

        return context;
    }
}