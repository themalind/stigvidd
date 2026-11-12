// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Spatial;

// keep-comment: the GeoJSON MultiPolygon coordinate arrays, [longitude, latitude], that the admin map draws and sends back
public static class GeoPolygonSerializer
{
    public static IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<double>>>> ToCoordinates(MultiPolygon area)
    {
        return area.Geometries
            .OfType<Polygon>()
            .Select(polygon => (IReadOnlyList<IReadOnlyList<IReadOnlyList<double>>>)
                new[] { polygon.Shell }.Concat(polygon.Holes)
                    .Select(ring => (IReadOnlyList<IReadOnlyList<double>>)ring.Coordinates
                        .Select(c => (IReadOnlyList<double>)[c.X, c.Y])
                        .ToList())
                    .ToList())
            .ToList();
    }

    // keep-comment: null when a position is not a [longitude, latitude] pair; the validator refuses those first
    public static MultiPolygon? FromCoordinates(IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<double>>>> coordinates)
    {
        if (coordinates.Any(polygon => polygon.Count == 0 || polygon.Any(ring => ring.Any(position => position.Count != 2))))
            return null;

        return GeoPointFactory.FromLonLatPolygons(coordinates.Select(polygon =>
            (IReadOnlyList<IReadOnlyList<Coordinate>>)polygon
                .Select(ring => (IReadOnlyList<Coordinate>)ring.Select(p => new Coordinate(p[0], p[1])).ToList())
                .ToList()));
    }
}
