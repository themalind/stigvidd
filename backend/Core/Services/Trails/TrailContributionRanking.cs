// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Spatial;
using Microsoft.Extensions.Configuration;
using NetTopologySuite.Geometries;

namespace Core.Services.Trails;

public class TrailContributionRanking
{
    public double HalfLifeDays { get; }
    public double Z { get; }
    public double LikeBonusWeight { get; }
    public int Take { get; }
    public double NearbyRadiusKm { get; }
    public TimeSpan CacheDuration { get; }

    public TrailContributionRanking(IConfiguration configuration)
    {
        var section = configuration.GetSection("ContributionRanking");
        HalfLifeDays = section.GetValue("HalfLifeDays", 180.0);
        Z = section.GetValue("Z", 1.96);
        LikeBonusWeight = section.GetValue("LikeBonusWeight", 0.05);
        Take = section.GetValue("Take", 10);
        NearbyRadiusKm = section.GetValue("NearbyRadiusKm", 50.0);
        CacheDuration = TimeSpan.FromMinutes(section.GetValue("CacheMinutes", 10.0));
    }

    public IReadOnlyList<RankedContribution> Rank(IEnumerable<ContributionRankingInput> trails, DateTime now)
    {
        return trails
            .Select(t => (Trail: t, Score: Score(t, now)))
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Trail.Identifier, StringComparer.Ordinal)
            .Select(x => new RankedContribution(x.Trail.Identifier, x.Trail.StartLatitude, x.Trail.StartLongitude))
            .ToList();
    }

    // keep-comment: without a position every trail qualifies; with one, only those starting within NearbyRadiusKm
    public IReadOnlyList<string> Pick(IReadOnlyList<RankedContribution> ranked, double? userLatitude, double? userLongitude)
    {
        IEnumerable<RankedContribution> candidates = ranked;

        if (userLatitude.HasValue && userLongitude.HasValue)
        {
            var latitude = userLatitude.Value;
            var longitude = userLongitude.Value;
            var projection = LocalMetricProjection.CentredOn(new Coordinate(longitude, latitude));
            var radiusMetres = NearbyRadiusKm * 1000.0;

            candidates = ranked.Where(c =>
            {
                var easting = (c.StartLongitude - longitude) * projection.MetresPerDegreeLongitude;
                var northing = (c.StartLatitude - latitude) * projection.MetresPerDegreeLatitude;
                return Math.Sqrt((easting * easting) + (northing * northing)) <= radiusMetres;
            });
        }

        return candidates.Take(Take).Select(c => c.Identifier).ToList();
    }

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
