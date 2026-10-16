// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class TrailContributionLikeRepositoryTests : TestBase
{
    private const string ContributedIdentifier = "con-1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";
    private const string CuratedIdentifier = "cur-1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";

    private static TrailRepository Build() =>
        new(
            CreateSeededFactory(db =>
            {
                db.Trails.Add(new Trail
                {
                    Identifier = ContributedIdentifier,
                    Name = "Användarleden",
                    TrailLength = 2m,
                    IsVerified = true,
                    GeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
                    Contribution = new TrailContribution { SubmittedByUserId = 2, ShowSubmitterName = true },
                });
                db.Trails.Add(new Trail
                {
                    Identifier = CuratedIdentifier,
                    Name = "Kurerade leden",
                    TrailLength = 2m,
                    IsVerified = true,
                    GeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
                });
            }),
            NullLogger<TrailRepository>.Instance);

    [Fact]
    public async Task Like_IsIdempotentAndUnlikeRemovesIt()
    {
        var repository = Build();
        var ct = TestContext.Current.CancellationToken;

        await repository.SetTrailLikeAsync(ContributedIdentifier, Utilities.Identifiers.User, true, ct);
        var twice = await repository.SetTrailLikeAsync(ContributedIdentifier, Utilities.Identifiers.User, true, ct);

        twice.IsSuccess.Should().BeTrue();
        twice.Value.Should().Be(new Core.Interfaces.Repositories.TrailLikeState(1, true));

        var unliked = await repository.SetTrailLikeAsync(ContributedIdentifier, Utilities.Identifiers.User, false, ct);

        unliked.IsSuccess.Should().BeTrue();
        unliked.Value.Should().Be(new Core.Interfaces.Repositories.TrailLikeState(0, false));
    }

    [Fact]
    public async Task Like_OnACuratedTrail_IsNotFound()
    {
        var result = await Build().SetTrailLikeAsync(CuratedIdentifier, Utilities.Identifiers.User, true, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task RankingInputs_HoldOnlyContributedTrails()
    {
        var repository = Build();
        await repository.SetTrailLikeAsync(ContributedIdentifier, Utilities.Identifiers.User, true, TestContext.Current.CancellationToken);

        var result = await repository.GetContributionRankingInputsAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Select(i => i.Identifier).Should().Equal(ContributedIdentifier);
        result.Value.Single().LikedAt.Should().HaveCount(1);
    }

    [Fact]
    public async Task PopularCuratedTrails_LeaveOutContributedOnes()
    {
        var result = await Build().GetPopularTrailOverviewsAsync(null, null, t => t.Identifier, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotContain(ContributedIdentifier);
    }
}
