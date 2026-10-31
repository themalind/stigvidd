// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Spatial;

public static class PathSimplifier
{
    // Douglas–Peucker in metres, keeping a subset of the original points. keep-comment: degrees cannot be the tolerance, a degree of longitude is half a degree of latitude here
    public static LineString Simplify(LineString path, double toleranceMetres)
    {
        var original = path.Coordinates;

        if (original.Length < 3)
            return GeoPointFactory.FromLonLatPath(original.Select(c => new Coordinate(c.X, c.Y)));

        var projection = LocalMetricProjection.CentredOn(path.EnvelopeInternal);
        var projected = original.Select(projection.Project).ToArray();
        var keep = new bool[original.Length];
        keep[0] = true;
        keep[^1] = true;

        var spans = new Stack<(int First, int Last)>();
        spans.Push((0, original.Length - 1));

        while (spans.Count > 0)
        {
            var (first, last) = spans.Pop();
            var farthest = -1;
            var farthestDistance = toleranceMetres;

            for (var i = first + 1; i < last; i++)
            {
                var distance = DistanceToSegment(projected[i], projected[first], projected[last]);

                if (distance > farthestDistance)
                {
                    farthest = i;
                    farthestDistance = distance;
                }
            }

            if (farthest < 0)
                continue;

            keep[farthest] = true;
            spans.Push((first, farthest));
            spans.Push((farthest, last));
        }

        return GeoPointFactory.FromLonLatPath(original.Where((_, i) => keep[i]).Select(c => new Coordinate(c.X, c.Y)));
    }

    private static double DistanceToSegment(Coordinate point, Coordinate start, Coordinate end)
    {
        var dx = end.X - start.X;
        var dy = end.Y - start.Y;
        var lengthSquared = dx * dx + dy * dy;

        if (lengthSquared == 0)
            return point.Distance(start);

        var t = Math.Clamp(((point.X - start.X) * dx + (point.Y - start.Y) * dy) / lengthSquared, 0, 1);

        return point.Distance(new Coordinate(start.X + t * dx, start.Y + t * dy));
    }
}
