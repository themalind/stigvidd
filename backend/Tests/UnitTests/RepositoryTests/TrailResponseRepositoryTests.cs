using Core;
using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;

namespace UnitTests.RepositoryTests;

public class TrailResponseRepositoryTests : TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailIdByIdentifierAsync(TivedenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailIdByIdentifierAsync("no-such-trail", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenFound_ReturnsTrail()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailByIdentifierWithoutCoordinatesAsync(TivedenIdentifier, CancellationToken.None);

        // Assert
        // Tiveden has IsVerified = false in seed data, so it is filtered out
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenVerified_ReturnsTrail()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        // Storsjöleden has IsVerified = true
        var result = await repo.GetTrailByIdentifierWithoutCoordinatesAsync(StorsjoledenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(StorsjoledenIdentifier);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailByIdentifierWithoutCoordinatesAsync("no-such-trail", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetCoordinates_WhenFound_ReturnsCoordinates()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetCoordinatesByTrailIdentifierAsync(StorsjoledenIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetCoordinates_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new TrailResponseRepository(CreateSeededFactory());

        // Act
        var result = await repo.GetCoordinatesByTrailIdentifierAsync("no-such-trail", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddTrail_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new TrailResponseRepository(factory);
        var trail = new Trail
        {
            Identifier = Guid.NewGuid().ToString(),
            Name = "NewTestTrail",
            TrailLength = 5.5M,
            Classification = 2,
            Accessibility = false,
            AccessibilityInfo = "Normal terrain",
            Description = "Test",
            FullDescription = string.Empty,
            TrailSymbol = "Red",
            TrailSymbolImage = "http://example.com/symbol.png",
            Coordinates = "[]",
            Tags = "[]",
            IsVerified = true,
            City = "TestCity",
            CreatedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
            TrailImages = []
        };

        // Act
        var result = await repo.AddTrailAsync(trail, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("NewTestTrail");

        var verify = await repo.GetTrailIdByIdentifierAsync(trail.Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }
}
