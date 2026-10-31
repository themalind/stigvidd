// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Spatial;

public static class PathTrim
{
    // keep-comment: a null index keeps that end as recorded; both are inclusive and must leave at least two points
    public static LineString? Trim(LineString path, int? startIndex, int? endIndex)
    {
        var coordinates = path.Coordinates;
        var start = startIndex ?? 0;
        var end = endIndex ?? coordinates.Length - 1;

        if (start < 0 || end >= coordinates.Length || end - start < 1)
            return null;

        // Longitude and latitude only: a recorded hike's height and time stay with the hike. keep-comment: privacy rule pinned by a test
        return GeoPointFactory.FromLonLatPath(coordinates[start..(end + 1)].Select(c => new Coordinate(c.X, c.Y)));
    }
}
