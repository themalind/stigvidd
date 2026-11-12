// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Repositories.CityAreas;

// keep-comment: the rule for what an area's boundary takes in; contributions never count and are filtered out before this
public static class CityAreaMembership
{
    public const double MinimumTrailShare = 0.25;

    public static bool Includes(MultiPolygon boundary, LineString path)
    {
        return TrailShare(boundary, path) >= MinimumTrailShare;
    }

    public static double TrailShare(MultiPolygon boundary, LineString path)
    {
        return PathMetrics.ShareInside(path, boundary);
    }

    public static bool Includes(MultiPolygon boundary, Point point)
    {
        return boundary.Intersects(point);
    }
}
