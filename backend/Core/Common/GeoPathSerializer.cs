using System.Text.Json;
using NetTopologySuite.Geometries;

namespace Core.Common;

// Serializes a geographic path into the wire format the clients expect:
// a JSON array of { latitude, longitude } points (see the app's CoordinateParser).
// A null path (a hike or trail without a stored route) serializes to an empty array.
public static class GeoPathSerializer
{
    public static string ToCoordinateJson(LineString? geoPath) =>
        geoPath is null
            ? "[]"
            : JsonSerializer.Serialize(
                geoPath.Coordinates.Select(c => new { latitude = c.Y, longitude = c.X }));
}
