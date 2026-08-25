using NetTopologySuite.Geometries;

namespace Core.Spatial;

// Builds every geometry this schema stores: the Points on Facility.Coordinates and
// TrailObstacle.IncidentLocation, and the LineStrings on Trail.GeoPath, Hike.GeoPath and
// TrailImportProposal.FeatureGeometry. The SRID and the (X = longitude, Y = latitude) order
// live here only, so no call site has to remember either — and the one WithSRID call below
// is the only one in the backend, which is what makes a second occurrence a review finding.
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

    /// <summary>
    /// A WGS84 path over (longitude, latitude) coordinates. Total by design: it builds the
    /// line it is given, including the EMPTY line the test seeds use for a hike with no
    /// recorded track — SpatiaLite accepts an empty LineString into a 4326 column, because
    /// the SRID lives in the blob header independently of the point count.
    /// NetTopologySuite rejects exactly one point (0 or >= 2 is legal); that throw is left to
    /// propagate, because every caller already decides what a degenerate path means — the
    /// services return 400, and the importers skip the feature.
    /// </summary>
    public static LineString FromLonLatPath(IEnumerable<Coordinate> lonLatCoordinates) =>
        Wgs84Factory.CreateLineString([.. lonLatCoordinates]);

    /// <summary>Latitude of a stored point, as the API contracts express it.</summary>
    public static decimal? ToLatitude(Point? point) => point is null ? null : (decimal)point.Y;

    /// <summary>Longitude of a stored point, as the API contracts express it.</summary>
    public static decimal? ToLongitude(Point? point) => point is null ? null : (decimal)point.X;
}
