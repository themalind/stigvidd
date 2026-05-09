using Core.Factories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace UnitTests.FactoryTests;

public class TrailObstaclesResponseFactoryTests
{
    private static TrailObstaclesResponseFactory BuildFactory() => new();

    [Fact]
    public void Create_Single_MapsAllFieldsCorrectly()
    {
        // Arrange
        var factory = BuildFactory();
        var obstacle = Utilities.Stubs.Obstacle();

        // Act
        var result = factory.Create(obstacle);

        // Assert
        result.Identifier.Should().Be(obstacle.Identifier);
        result.UserIdentifier.Should().Be(Utilities.Identifiers.User);
        result.Description.Should().Be("Fallen tree");
        result.IssueType.Should().Be(TrailIssueType.FallenTree.ToString());
    }

    [Fact]
    public void Create_Single_WithSolvedVotes_MapsSolvedVotes()
    {
        // Arrange
        var factory = BuildFactory();
        var obstacle = Utilities.Stubs.Obstacle(votes: [Utilities.Stubs.Vote()]);

        // Act
        var result = factory.Create(obstacle);

        // Assert
        result.SolvedVotes.Should().HaveCount(1);
        result.SolvedVotes.First().UserIdentifier.Should().Be(Utilities.Identifiers.User);
    }

    [Fact]
    public void Create_Single_WhenUserIsNull_ThrowsInvalidOperationException()
    {
        // Arrange
        var factory = BuildFactory();
        var obstacle = Utilities.Stubs.Obstacle();
        obstacle.User = null;

        // Act
        var act = () => factory.Create(obstacle);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Create_Collection_MapsAllItems()
    {
        // Arrange
        var factory = BuildFactory();
        IReadOnlyCollection<TrailObstacle> obstacles =
        [
            Utilities.Stubs.Obstacle(),
            Utilities.Stubs.Obstacle()
        ];

        // Act
        var result = factory.Create(obstacles);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public void Create_Collection_WhenUserIsNull_ThrowsInvalidOperationException()
    {
        // Arrange
        var factory = BuildFactory();
        var obstacle = Utilities.Stubs.Obstacle();
        obstacle.User = null;
        IReadOnlyCollection<TrailObstacle> obstacles = [obstacle];

        // Act
        var act = () => factory.Create(obstacles);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }
}
