// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Microsoft.Extensions.Configuration;

namespace UnitTests.ServiceTests;

public class TrailContributionRankingTests
{
    private static readonly DateTime Now = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);

    private static TrailContributionRanking Ranking(Dictionary<string, string?>? settings = null) =>
        new(new ConfigurationBuilder().AddInMemoryCollection(settings ?? []).Build());

    private static ContributionRankingInput Trail(string id, IEnumerable<(decimal Rating, int DaysAgo)>? reviews = null, IEnumerable<int>? likesDaysAgo = null) =>
        new(
            id,
            (reviews ?? []).Select(r => new RankedReview(r.Rating, Now.AddDays(-r.DaysAgo))).ToList(),
            (likesDaysAgo ?? []).Select(d => Now.AddDays(-d)).ToList());

    [Fact]
    public void Defaults_AreTheAgreedOnes()
    {
        var ranking = Ranking();

        ranking.HalfLifeDays.Should().Be(180);
        ranking.Z.Should().Be(1.96);
        ranking.LikeBonusWeight.Should().Be(0.05);
        ranking.Take.Should().Be(10);
    }

    [Fact]
    public void Settings_AreReadFromConfiguration()
    {
        var ranking = Ranking(new()
        {
            ["ContributionRanking:HalfLifeDays"] = "90",
            ["ContributionRanking:Z"] = "1.645",
            ["ContributionRanking:LikeBonusWeight"] = "0.1",
            ["ContributionRanking:Take"] = "3",
        });

        ranking.HalfLifeDays.Should().Be(90);
        ranking.Z.Should().Be(1.645);
        ranking.LikeBonusWeight.Should().Be(0.1);
        ranking.Take.Should().Be(3);
    }

    [Theory]
    [InlineData(0, 0, 0.0)]
    [InlineData(1, 1, 0.2065)]
    [InlineData(10, 10, 0.7225)]
    [InlineData(5, 10, 0.2366)]
    public void WilsonLowerBound_MatchesTheReferenceValues(double positives, double trials, double expected)
    {
        TrailContributionRanking.WilsonLowerBound(positives, trials, 1.96).Should().BeApproximately(expected, 0.0005);
    }

    [Fact]
    public void Decay_HalvesAtTheHalfLife()
    {
        var ranking = Ranking();

        ranking.Decay(Now, Now).Should().BeApproximately(1.0, 1e-9);
        ranking.Decay(Now.AddDays(-180), Now).Should().BeApproximately(0.5, 1e-9);
        ranking.Decay(Now.AddDays(-360), Now).Should().BeApproximately(0.25, 1e-9);
    }

    [Fact]
    public void ManyGoodReviews_BeatOneFiveStarReview()
    {
        var ranking = Ranking();
        var single = Trail("single", [(5m, 0)]);
        var many = Trail("many", Enumerable.Repeat((4.5m, 0), 20));

        ranking.Score(many, Now).Should().BeGreaterThan(ranking.Score(single, Now));
    }

    [Fact]
    public void RecentReviews_OutweighTheSameReviewsAYearAgo()
    {
        var ranking = Ranking();
        var recent = Trail("recent", Enumerable.Repeat((5m, 7), 10));
        var old = Trail("old", Enumerable.Repeat((5m, 365), 10));

        ranking.Score(recent, Now).Should().BeGreaterThan(ranking.Score(old, Now));
    }

    [Fact]
    public void RecentLikes_OutweighTheSameLikesAYearAgo()
    {
        var ranking = Ranking();
        var recent = Trail("recent", likesDaysAgo: Enumerable.Repeat(1, 50));
        var old = Trail("old", likesDaysAgo: Enumerable.Repeat(365, 50));

        ranking.Score(recent, Now).Should().BeGreaterThan(ranking.Score(old, Now));
    }

    [Fact]
    public void Likes_AreABonusOnTopOfTheReviews()
    {
        var ranking = Ranking();
        var withoutLikes = Trail("a", [(4m, 0)]);
        var withLikes = Trail("b", [(4m, 0)], Enumerable.Repeat(0, 9));

        (ranking.Score(withLikes, Now) - ranking.Score(withoutLikes, Now)).Should().BeApproximately(0.05, 1e-9);
    }

    [Fact]
    public void Rank_OrdersByScoreAndTakesTheConfiguredCount()
    {
        var ranking = Ranking(new() { ["ContributionRanking:Take"] = "2" });

        var ranked = ranking.Rank(
            [
                Trail("none"),
                Trail("best", Enumerable.Repeat((5m, 0), 20)),
                Trail("middle", Enumerable.Repeat((4m, 0), 5)),
            ],
            Now);

        ranked.Should().Equal("best", "middle");
    }
}
