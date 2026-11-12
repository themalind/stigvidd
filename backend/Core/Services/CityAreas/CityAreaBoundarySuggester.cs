// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Spatial;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;

namespace Core.Services.CityAreas;

// keep-comment: a starting boundary for the admin to adjust: a band around the linked trails and places, gaps under 2 × GapMetres filled
public static class CityAreaBoundarySuggester
{
    public const double BufferMetres = 200;
    public const double GapMetres = 500;
    public const double ToleranceMetres = 25;

    public static MultiPolygon? Suggest(IReadOnlyCollection<LineString> paths, IReadOnlyCollection<Point> points)
    {
        var lines = paths.Where(p => !p.IsEmpty).ToList();
        var places = points.Where(p => !p.IsEmpty).ToList();

        if (lines.Count == 0 && places.Count == 0)
            return null;

        var envelope = new Envelope();
        foreach (var source in lines.Cast<Geometry>().Concat(places))
        {
            envelope.ExpandToInclude(source.EnvelopeInternal);
        }

        var projection = LocalMetricProjection.CentredOn(envelope);
        Geometry[] metric = [
            .. lines.Select(projection.Project),
            .. places.Select(p => new Point(projection.Project(p.Coordinate))),
        ];

        var band = new GeometryCollection(metric).Buffer(BufferMetres);
        var closed = band.Buffer(GapMetres).Buffer(-GapMetres);
        var simplified = TopologyPreservingSimplifier.Simplify(closed, ToleranceMetres);

        var shells = Polygons(simplified)
            .Select(polygon => (IReadOnlyList<IReadOnlyList<Coordinate>>)
                [polygon.Shell.Coordinates.Select(projection.Unproject).ToList()])
            .ToList();

        return shells.Count == 0 ? null : GeoPointFactory.FromLonLatPolygons(shells);
    }

    private static IEnumerable<Polygon> Polygons(Geometry geometry)
    {
        return geometry switch
        {
            Polygon polygon => [polygon],
            MultiPolygon multi => multi.Geometries.OfType<Polygon>(),
            _ => [],
        };
    }
}
