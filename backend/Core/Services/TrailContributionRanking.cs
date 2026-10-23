// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.Configuration;

namespace Core.Services;

public record RankedReview(decimal Rating, DateTime At);

public record ContributionRankingInput(string Identifier, IReadOnlyCollection<RankedReview> Reviews, IReadOnlyCollection<DateTime> LikedAt);

public class TrailContributionRanking
{
    public double HalfLifeDays { get; }
    public double Z { get; }
    public double LikeBonusWeight { get; }
    public int Take { get; }
    public TimeSpan CacheDuration { get; }

    public TrailContributionRanking(IConfiguration configuration)
    {
        var section = configuration.GetSection("ContributionRanking");
        HalfLifeDays = section.GetValue("HalfLifeDays", 180.0);
        Z = section.GetValue("Z", 1.96);
        LikeBonusWeight = section.GetValue("LikeBonusWeight", 0.05);
        Take = section.GetValue("Take", 10);
        CacheDuration = TimeSpan.FromMinutes(section.GetValue("CacheMinutes", 10.0));
    }

    public IReadOnlyList<string> Rank(IEnumerable<ContributionRankingInput> trails, DateTime now) =>
        trails
            .Select(t => (t.Identifier, Score: Score(t, now)))
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Identifier, StringComparer.Ordinal)
            .Take(Take)
            .Select(x => x.Identifier)
            .ToList();

    public double Score(ContributionRankingInput trail, DateTime now)
    {
        var positives = 0.0;
        var trials = 0.0;

        foreach (var review in trail.Reviews)
        {
            var weight = Decay(review.At, now);
            // keep-comment: a rating of 1..5 counts as a fractional success, 1 -> 0 and 5 -> 1
            positives += weight * Math.Clamp(((double)review.Rating - 1.0) / 4.0, 0.0, 1.0);
            trials += weight;
        }

        var likes = trail.LikedAt.Sum(at => Decay(at, now));

        return WilsonLowerBound(positives, trials, Z) + (LikeBonusWeight * Math.Log10(1.0 + likes));
    }

    public double Decay(DateTime at, DateTime now)
    {
        var ageDays = Math.Max(0.0, (now - at).TotalDays);
        return HalfLifeDays <= 0 ? 1.0 : Math.Pow(0.5, ageDays / HalfLifeDays);
    }

    public static double WilsonLowerBound(double positives, double trials, double z)
    {
        if (trials <= 0)
            return 0.0;

        var p = positives / trials;
        var z2 = z * z;
        var centre = p + (z2 / (2 * trials));
        var margin = z * Math.Sqrt(((p * (1 - p)) + (z2 / (4 * trials))) / trials);

        return (centre - margin) / (1 + (z2 / trials));
    }
}
