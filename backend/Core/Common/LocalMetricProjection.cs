using NetTopologySuite.Geometries;

namespace Core.Common;

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

        return new LineString([.. line.Coordinates.Select(Project)]);
    }
}
