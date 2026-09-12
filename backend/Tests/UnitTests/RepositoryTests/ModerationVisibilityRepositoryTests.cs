// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

// Which read paths keep seeing hidden content and which stop. Getting one of these the wrong
// way round is the whole bug surface of the moderation filter: too much hiding orphans files
// on WebDAV, too little lets the author route around the hiding.
public class ModerationVisibilityRepositoryTests : TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string TangaledenIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string Review8Identifier = "r8b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d";
    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string Obstacle3Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string User2Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

    // Review 1: trail 1 (Tiveden), user 2, two images.
    private const int Review1TrailId = 1;
    private const int Review1UserId = 2;

    // Obstacle 1: trail 1, user 1, five days old and unvoted, so active.
    // Obstacle 3: trail 3, user 3, three solved votes, so expired.
    private const int Obstacle1UserId = 1;

    private static IDbContextFactory<StigViddDbContext> FactoryWithHiddenReview() =>
        CreateSeededFactory(db =>
            db.Reviews
                .IgnoreQueryFilters(["Moderation"])
                .Single(r => r.Identifier == Review1Identifier)
                .ModerationState = ModerationState.HiddenPendingReview);

    private static IDbContextFactory<StigViddDbContext> FactoryWithHiddenObstacle(string identifier) =>
        CreateSeededFactory(db =>
            db.TrailObstacles
                .IgnoreQueryFilters(["Moderation"])
                .Single(o => o.Identifier == identifier)
                .ModerationState = ModerationState.HiddenPendingReview);

    private static ReviewRepository BuildReviewRepo(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<ReviewRepository>.Instance);

    private static TrailObstacleRepository BuildObstacleRepo(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<TrailObstacleRepository>.Instance, new ConfigurationBuilder().Build());

    // Tiveden carries reviews 1 and 8. Paging is zero-indexed at this level.
    [Fact]
    public async Task ReviewList_WhenNothingIsHidden_ReturnsBothReviews()
    {
        // Arrange
        var repository = BuildReviewRepo(CreateSeededFactory());

        // Act
        var result = await repository.GetReviewsByTrailIdentifierAsync(
            TivedenIdentifier, 0, 20, r => r.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().Contain([Review1Identifier, Review8Identifier]);
        result.Value.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task ReviewList_LeavesTheHiddenReviewOutOfBothItemsAndTotalCount()
    {
        // Arrange
        var repository = BuildReviewRepo(FactoryWithHiddenReview());

        // Act
        var result = await repository.GetReviewsByTrailIdentifierAsync(
            TivedenIdentifier, 0, 20, r => r.Identifier, TestContext.Current.CancellationToken);

        // Assert — both, or the paging lies about how many pages there are
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().NotContain(Review1Identifier);
        result.Value.Items.Should().Contain(Review8Identifier);
        result.Value.TotalCount.Should().Be(1);
    }

    // Without this the author simply writes a replacement the moment theirs is hidden, and
    // the hiding means nothing.
    [Fact]
    public async Task HasUserReviewedTrail_StillSeesTheHiddenReview()
    {
        // Arrange
        var repository = BuildReviewRepo(FactoryWithHiddenReview());

        // Act
        var result = await repository.HasUserReviewedTrailAsync(
            Review1TrailId, Review1UserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    // The subquery case the design flags: UserReviews is fed into a Contains against
    // ReviewImages, and IgnoreQueryFilters applies to a query rather than an entity. Miss it
    // and account deletion silently stops cleaning files off WebDAV.
    [Fact]
    public async Task GetReviewImageUrlsByUserId_StillReturnsTheHiddenReviewsImages()
    {
        // Arrange
        var repository = BuildReviewRepo(FactoryWithHiddenReview());

        // Act
        var result = await repository.GetReviewImageUrlsByUserIdAsync(
            Review1UserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain("https://inkaben.se/stigvidd/mock/review-tiveden-1.jpg");
        result.Value.Should().Contain("https://inkaben.se/stigvidd/mock/review-tiveden-2.jpg");
    }

    [Fact]
    public async Task AnonymizeReviewsByUserId_AlsoClearsTheHiddenReview()
    {
        // Arrange
        var factory = FactoryWithHiddenReview();

        // Act
        var result = await BuildReviewRepo(factory).AnonymizeReviewsByUserIdAsync(
            Review1UserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(r => r.Identifier == Review1Identifier, TestContext.Current.CancellationToken);
        review.TrailReview.Should().BeNull();
    }

    // Deliberately NOT excepted. This is the owner's own delete path, and letting them
    // through would let them delete the hidden review and then write a fresh one.
    [Fact]
    public async Task GetReviewByIdentifier_DoesNotFindTheOwnersHiddenReview()
    {
        // Arrange
        var repository = BuildReviewRepo(FactoryWithHiddenReview());

        // Act
        var result = await repository.GetReviewByIdentifierAsync(
            Review1Identifier, User2Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task ActiveObstacles_LeaveOutTheHiddenObstacle()
    {
        // Arrange
        var repository = BuildObstacleRepo(FactoryWithHiddenObstacle(Obstacle1Identifier));

        // Act
        var result = await repository.GetTrailObstaclesByTrailIdentifierAsync(
            TivedenIdentifier, o => o.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotContain(Obstacle1Identifier);
    }

    // The vote freeze, and it is emergent rather than written: this is a general lookup by
    // identifier, so if someone excepts it later, voting on hidden content works again.
    [Fact]
    public async Task GetTrailObstacleByIdentifier_DoesNotFindTheHiddenObstacle()
    {
        // Arrange
        var repository = BuildObstacleRepo(FactoryWithHiddenObstacle(Obstacle1Identifier));

        // Act
        var result = await repository.GetTrailObstacleByIdentifierAsync(
            Obstacle1Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetTrailObstacleByIdentifierAndUserId_DoesNotFindTheOwnersHiddenObstacle()
    {
        // Arrange
        var repository = BuildObstacleRepo(FactoryWithHiddenObstacle(Obstacle1Identifier));

        // Act
        var result = await repository.GetTrailObstacleByIdentifierAndUserIdAsync(
            Obstacle1Identifier, Obstacle1UserId, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    // Excepted on purpose: retention has to keep clearing hidden rows, or the table grows
    // without bound.
    [Fact]
    public async Task DeleteExpiredObstacles_StillDeletesAHiddenExpiredObstacle()
    {
        // Arrange — obstacle 3 has three solved votes, so it is expired
        var factory = FactoryWithHiddenObstacle(Obstacle3Identifier);

        // Act
        var result = await BuildObstacleRepo(factory).DeleteExpiredObstaclesAsync(TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stillThere = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .AnyAsync(o => o.Identifier == Obstacle3Identifier, TestContext.Current.CancellationToken);
        stillThere.Should().BeFalse();
    }

    [Fact]
    public async Task AnonymizeObstaclesByUserId_AlsoClearsTheHiddenObstacle()
    {
        // Arrange
        var factory = FactoryWithHiddenObstacle(Obstacle1Identifier);

        // Act
        var result = await BuildObstacleRepo(factory).AnonymizeObstaclesByUserIdAsync(
            Obstacle1UserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var obstacle = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(o => o.Identifier == Obstacle1Identifier, TestContext.Current.CancellationToken);
        obstacle.Description.Should().BeEmpty();
    }

    // Unrelated to the tangaleden trail; kept so a future reader can see the obstacle seed
    // that the expiry test leans on has not moved.
    [Fact]
    public async Task ExpiredObstacleSeed_IsOnTheTrailTheseTestsAssume()
    {
        // Arrange
        var factory = CreateSeededFactory();

        // Act
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var obstacle = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .Include(o => o.Trail)
            .SingleAsync(o => o.Identifier == Obstacle3Identifier, TestContext.Current.CancellationToken);

        // Assert
        obstacle.Trail!.Identifier.Should().Be(TangaledenIdentifier);
    }
}
