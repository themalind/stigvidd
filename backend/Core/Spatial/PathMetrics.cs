// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Spatial;

public static class PathMetrics
{
    public static double LengthMetres(LineString path)
    {
        return path.NumPoints < 2 ? 0.0 : Projected(path).Length;
    }

    public static decimal LengthKm(LineString path)
    {
        return Math.Round((decimal)LengthMetres(path) / 1000m, 2);
    }

    // keep-comment: a GPS jump shows up as one long segment, e.g. a straight line across a lake
    public static double LongestGapMetres(LineString path)
    {
        if (path.NumPoints < 2)
            return 0.0;

        var coordinates = Projected(path).Coordinates;
        var longest = 0.0;

        for (var i = 1; i < coordinates.Length; i++)
            longest = Math.Max(longest, coordinates[i - 1].Distance(coordinates[i]));

        return longest;
    }

    // keep-comment: 0..1 of the path's length in metres that lies inside the area
    public static double ShareInside(LineString path, MultiPolygon area)
    {
        ArgumentNullException.ThrowIfNull(path);
        ArgumentNullException.ThrowIfNull(area);

        if (path.NumPoints < 2)
            return 0.0;

        var projection = LocalMetricProjection.CentredOn(path.EnvelopeInternal);
        var projectedPath = projection.Project(path);
        var length = projectedPath.Length;

        if (length <= 0.0)
            return 0.0;

        var inside = projection.Project(area).Intersection(projectedPath).Length;

        return Math.Min(1.0, inside / length);
    }

    private static LineString Projected(LineString path)
    {
        return LocalMetricProjection.CentredOn(path.EnvelopeInternal).Project(path);
    }
}
