using NetTopologySuite.Geometries;
using System.Text.Json;

namespace Core.Common;

// One feature as the source published it, before anything has been decided about it.
public sealed record SourceFeature(string ExternalId, string Name, string Properties, LineString Geometry);

// Reads the GeoJSON export. Features without usable geometry are skipped rather than
// failing the run: one broken line in the file should not stop the other two hundred.
public static class SourceFeatureReader
{
    public static IReadOnlyList<SourceFeature> Read(Stream geoJson)
    {
        ArgumentNullException.ThrowIfNull(geoJson);

        using var document = JsonDocument.Parse(geoJson);
        var features = new List<SourceFeature>();

        if (!document.RootElement.TryGetProperty("features", out var array) ||
            array.ValueKind != JsonValueKind.Array)
        {
            return features;
        }

        foreach (var feature in array.EnumerateArray())
        {
            var geometry = ReadGeometry(feature);

            if (geometry is null)
                continue;

            if (!feature.TryGetProperty("properties", out var properties) ||
                properties.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            features.Add(new SourceFeature(
                ReadString(properties, "id"),
                ReadString(properties, "namn"),
                properties.GetRawText(),
                geometry));
        }

        return features;
    }

    private static LineString? ReadGeometry(JsonElement feature)
    {
        if (!feature.TryGetProperty("geometry", out var geometry) ||
            geometry.ValueKind != JsonValueKind.Object ||
            !geometry.TryGetProperty("coordinates", out var coordinates) ||
            coordinates.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var points = new List<Coordinate>();

        foreach (var point in coordinates.EnumerateArray())
        {
            if (point.ValueKind != JsonValueKind.Array || point.GetArrayLength() < 2)
                return null;

            points.Add(new Coordinate(point[0].GetDouble(), point[1].GetDouble()));
        }

        // A single point cannot be matched against anything, and an empty one cannot be
        // fingerprinted at all.
        return points.Count < 2 ? null : GeoPointFactory.FromLonLatPath(points);
    }

    // The source writes id as a number and namn as a string, and leaves either out.
    private static string ReadString(JsonElement properties, string name) =>
        properties.TryGetProperty(name, out var value) && value.ValueKind is not JsonValueKind.Null
            ? value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : value.GetRawText()
            : string.Empty;
}
