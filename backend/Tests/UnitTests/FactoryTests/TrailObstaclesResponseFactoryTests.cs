// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using AwesomeAssertions;
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
    public void Create_Collection_LeavesOutAHiddenVoterButCountsThem()
    {
        // Arrange
        var factory = BuildFactory();
        var hidden = Utilities.Stubs.Vote();
        var shown = Utilities.Stubs.Vote();
        shown.UserId = 2;
        shown.User = new User { Id = 2, Identifier = "other-voter", NickName = "Other", Email = "other@test.com", SubjectId = "uid-2" };
        IReadOnlyCollection<TrailObstacle> obstacles = [Utilities.Stubs.Obstacle(votes: [hidden, shown])];

        // Act
        var result = factory.Create(obstacles, [hidden.UserId]);

        // Assert
        var obstacle = result.Should().ContainSingle().Subject;
        obstacle.SolvedVotes.Should().ContainSingle().Which.UserIdentifier.Should().Be("other-voter");
        obstacle.SolvedVoteCount.Should().Be(2);
    }

    [Fact]
    public void Create_Collection_WithNothingHidden_ListsAndCountsEveryVote()
    {
        // Arrange
        var factory = BuildFactory();
        IReadOnlyCollection<TrailObstacle> obstacles = [Utilities.Stubs.Obstacle(votes: [Utilities.Stubs.Vote()])];

        // Act
        var result = factory.Create(obstacles, []);

        // Assert
        var obstacle = result.Should().ContainSingle().Subject;
        obstacle.SolvedVotes.Should().ContainSingle();
        obstacle.SolvedVoteCount.Should().Be(1);
    }

    [Fact]
    public void Create_Single_WhenUserIsNull_ReturnsNullUserIdentifier()
    {
        // Arrange — a report whose reporter is gone
        var factory = BuildFactory();
        var obstacle = Utilities.Stubs.Obstacle();
        obstacle.User = null;

        // Act
        var result = factory.Create(obstacle);

        // Assert
        result.UserIdentifier.Should().BeNull();
        result.Description.Should().Be(obstacle.Description);
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
        var result = factory.Create(obstacles, []);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public void Create_Collection_WhenUserIsNull_ReturnsNullUserIdentifier()
    {
        // Arrange — one report without a reporter, one with
        var factory = BuildFactory();
        var obstacle = Utilities.Stubs.Obstacle();
        obstacle.User = null;
        IReadOnlyCollection<TrailObstacle> obstacles = [obstacle, Utilities.Stubs.Obstacle()];

        // Act
        var result = factory.Create(obstacles, []);

        // Assert
        result.Should().HaveCount(2);
        result.First().UserIdentifier.Should().BeNull();
        result.Last().UserIdentifier.Should().Be(Utilities.Identifiers.User);
    }
}
