// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using NetTopologySuite.Geometries;

namespace Core.Services.CityAreas;

public static class CityAreaRanking
{
    private static readonly StringComparer SwedishNames = StringComparer.Create(new CultureInfo("sv-SE"), ignoreCase: true);

    // keep-comment: nearest first with a user position (areas without a boundary last), else most popular first; ties by name
    public static IReadOnlyList<(CityAreaProjection Area, double? DistanceKm)> Order(
        IReadOnlyCollection<CityAreaProjection> areas, Coordinate? user)
    {
        var ranked = areas.Select(area => (Area: area, DistanceKm: DistanceKm(area.Boundary, user)));

        var ordered = user is null
            ? ranked.OrderByDescending(r => Popularity(r.Area))
            : ranked.OrderBy(r => r.DistanceKm is null).ThenBy(r => r.DistanceKm).ThenByDescending(r => Popularity(r.Area));

        return [.. ordered.ThenBy(r => r.Area.Name, SwedishNames)];
    }

    // keep-comment: 0 inside the boundary
    public static double? DistanceKm(MultiPolygon? boundary, Coordinate? user)
    {
        if (boundary is null || boundary.IsEmpty || user is null)
            return null;

        var projected = LocalMetricProjection.CentredOn(user).Project(boundary);

        return projected.Distance(new Point(0, 0)) / 1000;
    }

    // keep-comment: the mean rating of the area's rated trails, like the popular trails list
    private static double Popularity(CityAreaProjection area)
    {
        var ratings = area.Trails.Where(t => t.AverageRating > 0).Select(t => (double)t.AverageRating).ToList();

        return ratings.Count == 0 ? 0 : ratings.Average();
    }
}
