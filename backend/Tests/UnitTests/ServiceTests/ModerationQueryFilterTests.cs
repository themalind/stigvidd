// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Repositories;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebDataContracts.ResponseModels.Trail;

namespace UnitTests.ServiceTests;

// The moderation design rests on the query filter on Review reaching the rating averages,
// which the callers build as an Expression and the repository only plugs into its Select.
// If it does not reach them, a hidden review still counts towards every trail's rating.
public class ModerationQueryFilterTests : TestBase
{
    private const string TrailIdentifier = "mod-1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";

    private static Trail TrailWithTwoReviews(ModerationState stateOfTheOne) => new()
    {
        Identifier = TrailIdentifier,
        Name = "Moderationsleden",
        TrailLength = 5M,
        IsVerified = true,
        City = "City",
        GeoPath = Utilities.GeoPath((12.80, 57.62), (12.81, 57.63)),
        Reviews =
        [
            new Review { Identifier = "mod-rev-5", Rating = 5M, UserId = 1 },
            new Review { Identifier = "mod-rev-1", Rating = 1M, UserId = 1, ModerationState = stateOfTheOne },
        ],
    };

    private static TrailService BuildService(ModerationState stateOfTheOne)
    {
        var factory = CreateSeededFactory(db => db.Trails.Add(TrailWithTwoReviews(stateOfTheOne)));
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new TrailService(
            new TrailRepository(factory, NullLogger<TrailRepository>.Instance),
            Utilities.MockFactory.WebDavService().Object,
            Utilities.MockFactory.MediaUploadService().Object,
            NullLogger<TrailService>.Instance,
            new TrailResponseFactory(cfg.Object));
    }

    [Fact]
    public async Task GetTrailCard_WhenNothingIsHidden_AveragesBothReviews()
    {
        // Arrange
        var service = BuildService(ModerationState.Visible);

        // Act
        var result = await service.GetTrailCardByIdentifierAsync(TrailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.AverageRating.Should().Be(3M);
    }

    [Fact]
    public async Task GetTrailCard_WhenOneReviewIsHidden_LeavesItOutOfTheAverage()
    {
        // Arrange
        var service = BuildService(ModerationState.HiddenPendingReview);

        // Act
        var result = await service.GetTrailCardByIdentifierAsync(TrailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.AverageRating.Should().Be(5M);
    }

    // The design's escape hatch: every path that must see hidden content drops this filter
    // by name, so a filter someone adds later is not dropped with it.
    [Fact]
    public async Task IgnoreQueryFiltersByName_SeesTheHiddenReview()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.Trails.Add(TrailWithTwoReviews(ModerationState.HiddenPendingReview)));
        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);

        // Act
        var hidden = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .Where(r => r.Identifier == "mod-rev-1")
            .ToListAsync(TestContext.Current.CancellationToken);

        var filtered = await context.Reviews
            .Where(r => r.Identifier == "mod-rev-1")
            .ToListAsync(TestContext.Current.CancellationToken);

        // Assert
        hidden.Should().ContainSingle();
        filtered.Should().BeEmpty();
    }

    // The popularity ranking is the one aggregate site with a different shape: the average
    // sits in a `let` that an `orderby` reads, not only in the caller's selector. Two trails
    // sharing a start point so the proximity term cancels and the rating alone decides.
    private const string HighTrailIdentifier = "mod-high-2b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e";
    private const string LowTrailIdentifier = "mod-low-3c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f";

    private static Trail RankingTrail(string identifier, decimal rating, ModerationState state) => new()
    {
        Identifier = identifier,
        Name = identifier,
        TrailLength = 5M,
        IsVerified = true,
        City = "City",
        GeoPath = Utilities.GeoPath((12.80, 57.62), (12.81, 57.63)),
        Reviews = [new Review { Identifier = $"rev-{identifier}", Rating = rating, UserId = 1, ModerationState = state }],
    };

    private static TrailService BuildRankingService(ModerationState stateOfTheHighReview)
    {
        var factory = CreateSeededFactory(db =>
        {
            db.Trails.Add(RankingTrail(HighTrailIdentifier, 5.0M, stateOfTheHighReview));
            db.Trails.Add(RankingTrail(LowTrailIdentifier, 4.0M, ModerationState.Visible));
        });
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new TrailService(
            new TrailRepository(factory, NullLogger<TrailRepository>.Instance),
            Utilities.MockFactory.WebDavService().Object,
            Utilities.MockFactory.MediaUploadService().Object,
            NullLogger<TrailService>.Instance,
            new TrailResponseFactory(cfg.Object));
    }

    private static (int High, int Low) PositionsIn(IReadOnlyCollection<TrailOverviewResponse?> overviews)
    {
        var order = overviews.Select(o => o!.Identifier).ToList();
        return (order.IndexOf(HighTrailIdentifier), order.IndexOf(LowTrailIdentifier));
    }

    [Theory]
    [InlineData(null, null)]        // rating-only branch
    [InlineData(57.62, 12.80)]      // proximity branch, equal for both trails
    public async Task PopularTrails_WhenNothingIsHidden_RanksTheBetterRatedTrailFirst(double? latitude, double? longitude)
    {
        // Arrange
        var service = BuildRankingService(ModerationState.Visible);

        // Act
        var result = await service.GetPopularTrailOverviewsAsync(latitude, longitude, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        var (high, low) = PositionsIn(result.Value!);
        high.Should().BeGreaterThanOrEqualTo(0);
        low.Should().BeGreaterThanOrEqualTo(0);
        high.Should().BeLessThan(low);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData(57.62, 12.80)]
    public async Task PopularTrails_WhenTheBetterReviewIsHidden_DropsThatTrailBelow(double? latitude, double? longitude)
    {
        // Arrange — the 5.0 is hidden, so that trail scores 0 and the 4.0 trail wins
        var service = BuildRankingService(ModerationState.HiddenPendingReview);

        // Act
        var result = await service.GetPopularTrailOverviewsAsync(latitude, longitude, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        var (high, low) = PositionsIn(result.Value!);
        high.Should().BeGreaterThanOrEqualTo(0);
        low.Should().BeGreaterThanOrEqualTo(0);
        low.Should().BeLessThan(high);
        result.Value!.Single(o => o!.Identifier == HighTrailIdentifier)!.AverageRating.Should().Be(0M);
    }

    // The remaining aggregate sites. All build their own average and hand it down as an
    // Expression, so each one has to be shown rather than assumed.
    [Fact]
    public async Task GetTrailCards_LeavesTheHiddenReviewOutOfTheAverage()
    {
        // Arrange
        var service = BuildService(ModerationState.HiddenPendingReview);

        // Act
        var result = await service.GetTrailCardsByIdentifiersAsync([TrailIdentifier], CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.Single().AverageRating.Should().Be(5M);
    }

    [Fact]
    public async Task GetAllTrails_LeavesTheHiddenReviewOutOfTheAverage()
    {
        // Arrange
        var service = BuildService(ModerationState.HiddenPendingReview);

        // Act
        var result = await service.GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.Single(t => t.Identifier == TrailIdentifier).AverageRating.Should().Be(5M);
    }

    // The city area page builds the same average twice, once per projection.
    private const string CityAreaIdentifier = "mod-area-4d4e5f6a-7b8c-9d0e-1f2a-3b4c5d6e7f8a";

    private static CityAreaService BuildCityAreaService(ModerationState stateOfTheOne)
    {
        var factory = CreateSeededFactory(db => db.CityAreas.Add(new CityArea
        {
            Identifier = CityAreaIdentifier,
            Name = "Moderationsområdet",
            Location = "Nowhere",
            Trails = [TrailWithTwoReviews(stateOfTheOne)],
        }));
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new CityAreaService(
            new CityAreaRepository(factory, NullLogger<CityAreaRepository>.Instance),
            new CityAreaResponseFactory(cfg.Object));
    }

    [Fact]
    public async Task CityAreaByIdentifier_LeavesTheHiddenReviewOutOfTheAverage()
    {
        // Arrange
        var service = BuildCityAreaService(ModerationState.HiddenPendingReview);

        // Act
        var result = await service.GetByIdentifierAsync(CityAreaIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.Trails.Single(t => t.Identifier == TrailIdentifier).AverageRating.Should().Be(5M);
    }

    [Fact]
    public async Task AllCityAreas_LeaveTheHiddenReviewOutOfTheAverage()
    {
        // Arrange
        var service = BuildCityAreaService(ModerationState.HiddenPendingReview);

        // Act
        var result = await service.GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!
            .Single(a => a.Identifier == CityAreaIdentifier).Trails
            .Single(t => t.Identifier == TrailIdentifier).AverageRating.Should().Be(5M);
    }
}
