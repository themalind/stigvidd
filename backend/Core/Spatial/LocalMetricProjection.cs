// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Spatial;

// Projects WGS84 degrees onto a flat metric plane centred on the data, so distances come
// out in metres without pulling in a projection library. Good to well under a metre across
// a municipality, which is all the trail matching covers; not meant for anything larger.
public sealed class LocalMetricProjection
{
    private readonly double _originLongitude;
    private readonly double _originLatitude;
    private readonly double _metresPerDegreeLatitude;
    private readonly double _metresPerDegreeLongitude;

    private LocalMetricProjection(double originLongitude, double originLatitude)
    {
        _originLongitude = originLongitude;
        _originLatitude = originLatitude;

        var radians = originLatitude * Math.PI / 180;

        // Meridian and parallel arc lengths at this latitude, the usual series expansion.
        _metresPerDegreeLatitude = 111132.92
            - 559.82 * Math.Cos(2 * radians)
            + 1.175 * Math.Cos(4 * radians);

        _metresPerDegreeLongitude = 111412.84 * Math.Cos(radians)
            - 93.5 * Math.Cos(3 * radians);
    }

    /// <summary>
    /// Centred on a single point — the natural origin when distances are measured FROM
    /// somewhere, such as a user location, rather than across a region.
    /// </summary>
    public static LocalMetricProjection CentredOn(Coordinate origin)
    {
        ArgumentNullException.ThrowIfNull(origin);

        return new LocalMetricProjection(origin.X, origin.Y);
    }

    /// <summary>Metres per degree of latitude at the origin.</summary>
    public double MetresPerDegreeLatitude => _metresPerDegreeLatitude;

    /// <summary>Metres per degree of longitude at the origin. Barely half the latitude
    /// figure at Swedish latitudes, which is why the two cannot share a scale.</summary>
    public double MetresPerDegreeLongitude => _metresPerDegreeLongitude;

    public static LocalMetricProjection CentredOn(Envelope area)
    {
        ArgumentNullException.ThrowIfNull(area);

        if (area.IsNull)
            throw new ArgumentException("Cannot centre a projection on an empty envelope.", nameof(area));

        return new LocalMetricProjection((area.MinX + area.MaxX) / 2, (area.MinY + area.MaxY) / 2);
    }

    public Coordinate Project(Coordinate coordinate) => new(
        (coordinate.X - _originLongitude) * _metresPerDegreeLongitude,
        (coordinate.Y - _originLatitude) * _metresPerDegreeLatitude);

    public LineString Project(LineString line)
    {
        ArgumentNullException.ThrowIfNull(line);

        // Deliberately the raw NTS factory, not GeoPointFactory: these coordinates are
        // METRES on a flat plane, not degrees. Nothing here is ever persisted, and stamping
        // it 4326 would be a lie about its units.
        return new LineString([.. line.Coordinates.Select(Project)]);
    }
}
