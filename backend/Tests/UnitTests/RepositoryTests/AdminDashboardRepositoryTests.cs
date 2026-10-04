// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class AdminDashboardRepositoryTests : TestBase
{
    private static readonly DateTime Since = new(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);

    private static void SeedDated(Infrastructure.Data.StigViddDbContext ctx)
    {
        foreach (var user in ctx.Users)
            user.CreatedAt = Since.AddYears(-1);
        foreach (var review in ctx.Reviews)
            review.CreatedAt = Since.AddYears(-1);

        ctx.Users.Add(new User { NickName = "Ny", Email = "ny@example.com", SubjectId = "sub-new", CreatedAt = Since.AddDays(1) });

        var trailId = ctx.Trails.First().Id;
        var userId = ctx.Users.First().Id;
        ctx.Reviews.Add(new Review { Identifier = "rev-newest", TrailId = trailId, UserId = userId, Rating = 5, CreatedAt = Since.AddDays(2) });
        ctx.Reviews.Add(new Review { Identifier = "rev-newer", TrailId = trailId, UserId = userId, Rating = 4, CreatedAt = Since.AddDays(1) });
    }

    [Fact]
    public async Task GetCounts_CountsEverythingAndWhatIsNewSinceTheCutoff()
    {
        // Arrange
        var factory = CreateSeededFactory(SeedDated);
        var repo = new AdminDashboardRepository(factory, NullLogger<AdminDashboardRepository>.Instance);
        int seededUsers, seededReviews;
        using (var ctx = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            seededUsers = ctx.Users.Count();
            seededReviews = ctx.Reviews.Count();
        }

        // Act
        var result = await repo.GetCountsAsync(Since, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.UserCount.Should().Be(seededUsers);
        result.Value.NewUsers.Should().Be(1);
        result.Value.ReviewCount.Should().Be(seededReviews);
        result.Value.NewReviews.Should().Be(2);
    }

    [Fact]
    public async Task GetLatestReviews_ReturnsTheNewestFirstAndRespectsTake()
    {
        // Arrange
        var repo = new AdminDashboardRepository(CreateSeededFactory(SeedDated), NullLogger<AdminDashboardRepository>.Instance);

        // Act
        var result = await repo.GetLatestReviewsAsync(2, r => r.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Equal("rev-newest", "rev-newer");
    }

    [Fact]
    public async Task GetLatestReviews_IncludesHiddenReviews()
    {
        // Arrange
        var repo = new AdminDashboardRepository(CreateSeededFactory(ctx =>
        {
            SeedDated(ctx);
            ctx.Reviews.Add(new Review
            {
                Identifier = "rev-hidden",
                TrailId = ctx.Trails.First().Id,
                UserId = ctx.Users.First().Id,
                Rating = 1,
                CreatedAt = Since.AddDays(3),
                ModerationState = ModerationState.HiddenPendingReview,
            });
        }), NullLogger<AdminDashboardRepository>.Instance);

        // Act
        var result = await repo.GetLatestReviewsAsync(1, r => r.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Equal("rev-hidden");
    }
}
