using NetTopologySuite.Geometries;

namespace Core.Common;

// Builds the Point geometry stored on Facility.Coordinates and TrailObstacle.IncidentLocation
// from the lat/long decimals the API contracts carry. The SRID and the (X = longitude,
// Y = latitude) order live here only, so no call site has to remember either.
public static class GeoPointFactory
{
    public const int Wgs84Srid = 4326;

    // One factory for every point we build. NTS geometry factories are immutable and
    // thread-safe, so there is no reason to derive a fresh one per call.
    private static readonly GeometryFactory Wgs84Factory = Geometry.DefaultFactory.WithSRID(Wgs84Srid);

    /// <summary>
    /// A WGS84 point, or null when either ordinate is missing — a half pair is not a location.
    /// Requests are rejected before this by the both-or-neither validator rules.
    /// </summary>
    public static Point? FromLonLat(decimal? longitude, decimal? latitude) =>
        longitude.HasValue && latitude.HasValue
            ? FromLonLat((double)longitude.Value, (double)latitude.Value)
            : null;

    /// <inheritdoc cref="FromLonLat(decimal?, decimal?)"/>
    public static Point? FromLonLat(double? longitude, double? latitude) =>
        longitude.HasValue && latitude.HasValue
            ? FromLonLat(longitude.Value, latitude.Value)
            : null;

    public static Point FromLonLat(double longitude, double latitude) =>
        Wgs84Factory.CreatePoint(new Coordinate(longitude, latitude));

    /// <summary>Latitude of a stored point, as the API contracts express it.</summary>
    public static decimal? ToLatitude(Point? point) => point is null ? null : (decimal)point.Y;

    /// <summary>Longitude of a stored point, as the API contracts express it.</summary>
    public static decimal? ToLongitude(Point? point) => point is null ? null : (decimal)point.X;
}
