// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Core.Telemetry;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.ResponseModels.User;

namespace UnitTests.Telemetry;

/// <summary>
/// What the services actually record.
///
/// These assert the TAGS, not just that something was counted. A test that only counts
/// measurements stays green when the attribute vocabulary regresses — and the vocabulary is the
/// half with the 730-day retention and the GDPR argument attached to it
/// (docs/observability.md), so it is the half worth pinning.
/// </summary>
public class ServiceMetricsTests
{
    private static UserService BuildUserService(Mock<IUserRepository> repo, StigviddMetrics metrics)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new UserService(
            repo.Object,
            new Mock<ITrailObstacleRepository>().Object,
            new UserResponseFactory(cfg.Object),
            new Mock<IHikeService>().Object,
            new Mock<IReviewService>().Object,
            new Mock<IFriendRepository>().Object,
            new Mock<IContentReportRepository>().Object,
            new Mock<IMailOutboxRepository>().Object,
            metrics);
    }

    private static Mock<IUserRepository> AddToFavoritesReturning(RepositoryResult<UserFavoritesTrailResponse> result)
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.AddTrailToUserFavoritesListAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Expression<Func<Trail, UserFavoritesTrailResponse>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(result);

        return repo;
    }

    [Fact]
    public async Task AddingToFavorites_RecordsOneChange_TaggedListOperationAndOutcome()
    {
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);

        var response = UserFavoritesTrailResponse.Create(
            Utilities.Identifiers.Trail1, "Trail", 5M, "Borås", 1, false, null, null, null, null);
        var repo = AddToFavoritesReturning(RepositoryResult<UserFavoritesTrailResponse>.Success(response));

        await BuildUserService(repo, metrics).AddTrailToUserFavoritesListAsync(
            Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

        // Without this the assertions below would also pass for an instrument that does not
        // exist, because a mistyped name simply records nothing.
        recorded.PublishedInstruments.Should().Contain(MetricNames.TrailFavoritesChanged);

        var measurements = recorded.For(MetricNames.TrailFavoritesChanged);
        measurements.Should().ContainSingle();

        var measurement = measurements[0];
        measurement.Value.Should().Be(1);
        measurement.Tags.Should().Contain("list", "favorites");
        measurement.Tags.Should().Contain("operation", "add");
        measurement.Tags.Should().Contain("outcome", "success");
    }

    [Theory]
    [InlineData(RepositoryResultStatus.Error, "error")]
    [InlineData(RepositoryResultStatus.NotFound, "not_found")]
    [InlineData(RepositoryResultStatus.Conflict, "conflict")]
    public async Task AddingToFavorites_StillRecordsExactlyOnce_WhenTheRepositoryRefuses(
        RepositoryResultStatus status,
        string expectedOutcome)
    {
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);

        var repo = AddToFavoritesReturning(status switch
        {
            RepositoryResultStatus.Error => RepositoryResult<UserFavoritesTrailResponse>.Error(),
            RepositoryResultStatus.NotFound => RepositoryResult<UserFavoritesTrailResponse>.NotFound(),
            _ => RepositoryResult<UserFavoritesTrailResponse>.Conflict(),
        });

        await BuildUserService(repo, metrics).AddTrailToUserFavoritesListAsync(
            Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

        var measurements = recorded.For(MetricNames.TrailFavoritesChanged);
        measurements.Should().ContainSingle("a failed change is still a change that happened");
        measurements[0].Tags.Should().Contain("outcome", expectedOutcome);
    }

    [Fact]
    public async Task RemovingFromWishlist_IsTaggedAsTheWishlistAndAsARemoval()
    {
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);

        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RemoveTrailFromUserWishListAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        await BuildUserService(repo, metrics).RemoveTrailFromUserWishListAsync(
            Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

        var measurement = recorded.For(MetricNames.TrailFavoritesChanged).Should().ContainSingle().Subject;
        measurement.Tags.Should().Contain("list", "wishlist");
        measurement.Tags.Should().Contain("operation", "remove");
    }

    [Fact]
    public async Task NoMeasurementCarriesTheTrailOrTheUser()
    {
        // The GDPR rule in executable form. Metrics live for 730 days, so which trail a given
        // person saved must not be derivable from them — and a trail identifier is exactly the
        // kind of "it is only content data" dimension that gets added without thinking.
        using var metrics = new StigviddMetrics();
        using var recorded = new RecordedMetrics(metrics);

        var response = UserFavoritesTrailResponse.Create(
            Utilities.Identifiers.Trail1, "Trail", 5M, "Borås", 1, false, null, null, null, null);
        var repo = AddToFavoritesReturning(RepositoryResult<UserFavoritesTrailResponse>.Success(response));

        await BuildUserService(repo, metrics).AddTrailToUserFavoritesListAsync(
            Utilities.Identifiers.User, Utilities.Identifiers.Trail1, TestContext.Current.CancellationToken);

        var tagValues = recorded.Measurements.SelectMany(m => m.Tags.Values).ToArray();

        tagValues.Should().NotContain(Utilities.Identifiers.Trail1);
        tagValues.Should().NotContain(Utilities.Identifiers.User);

        recorded.Measurements.SelectMany(m => m.Tags.Keys)
            .Should().OnlyContain(k => k == "list" || k == "operation" || k == "outcome");
    }
}
