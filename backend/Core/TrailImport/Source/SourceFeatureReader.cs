// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Spatial;
using Core.TrailImport.Source;
using NetTopologySuite.Geometries;
using System.Text.Json;

namespace Core.TrailImport.Source;

// One feature as the source published it, before anything has been decided about it.
public sealed record SourceFeature(string ExternalId, string Name, string Properties, LineString Geometry);

// Reads the GeoJSON export. Features without usable geometry are skipped rather than
// failing the run: one broken line in the file should not stop the other two hundred.
public static class SourceFeatureReader
{
    // keep-comment: see docs/notes/umea-trail-export-differs-from-boras.md
    // keep-comment: why 25 m — Umeå's MultiLineString parts meet within 0–18 m but never exactly, and the ones that do not meet are 400+ m apart; joining those draws a line that is no trail.
    private const double JoinToleranceMetres = 25;

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

        var project = ProjectionFor(document.RootElement);

        foreach (var feature in array.EnumerateArray())
        {
            var lines = ReadGeometry(feature, project);

            if (lines.Count == 0)
                continue;

            if (!feature.TryGetProperty("properties", out var properties) ||
                properties.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var externalId = ReadFirstString(properties, "id", "LED_ID", "OBJECTID", "FID");
            var name = ReadFirstString(properties, "namn", "LEDNAMN", "STATLIGLEDNAMN");
            var raw = properties.GetRawText();

            for (var i = 0; i < lines.Count; i++)
            {
                features.Add(new SourceFeature(
                    i == 0 || externalId.Length == 0 ? externalId : $"{externalId}#{i + 1}",
                    name,
                    raw,
                    lines[i]));
            }
        }

        return features;
    }

    // keep-comment: Naturvårdsverket's exports declare EPSG:3006 (SWEREF99 TM, metres) in "crs";
    // keep-comment: every other known source either declares CRS84 or leaves "crs" out, which GeoJSON defines as WGS84 — both already (lon, lat).
    private static Func<double, double, Coordinate> ProjectionFor(JsonElement root)
    {
        if (root.TryGetProperty("crs", out var crs) &&
            crs.TryGetProperty("properties", out var crsProperties) &&
            crsProperties.TryGetProperty("name", out var crsName) &&
            crsName.ValueKind == JsonValueKind.String &&
            (crsName.GetString() ?? string.Empty).Contains("3006", StringComparison.Ordinal))
        {
            return (easting, northing) =>
            {
                var (longitude, latitude) = Sweref99TmProjection.ToWgs84(easting, northing);
                return new Coordinate(longitude, latitude);
            };
        }

        return (x, y) => new Coordinate(x, y);
    }

    private static IReadOnlyList<LineString> ReadGeometry(JsonElement feature, Func<double, double, Coordinate> project)
    {
        if (!feature.TryGetProperty("geometry", out var geometry) ||
            geometry.ValueKind != JsonValueKind.Object ||
            !geometry.TryGetProperty("coordinates", out var coordinates) ||
            coordinates.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        // keep-comment: shape, not "type" — the Borås export and the existing fixtures leave "type" out.
        if (coordinates.GetArrayLength() > 0 && IsLine(coordinates[0]))
        {
            var parts = new List<List<Coordinate>>();

            foreach (var part in coordinates.EnumerateArray())
            {
                if (ReadPoints(part, project) is { Count: >= 2 } points)
                    parts.Add(points);
            }

            return [.. Chain(parts).Select(GeoPointFactory.FromLonLatPath)];
        }

        // A single point cannot be matched against anything, and an empty one cannot be
        // fingerprinted at all.
        return ReadPoints(coordinates, project) is { Count: >= 2 } line
            ? [GeoPointFactory.FromLonLatPath(line)]
            : [];
    }

    private static bool IsLine(JsonElement element) =>
        element.ValueKind == JsonValueKind.Array &&
        element.GetArrayLength() > 0 &&
        element[0].ValueKind == JsonValueKind.Array;

    private static List<Coordinate>? ReadPoints(JsonElement line, Func<double, double, Coordinate> project)
    {
        if (line.ValueKind != JsonValueKind.Array)
            return null;

        var points = new List<Coordinate>();

        foreach (var point in line.EnumerateArray())
        {
            if (point.ValueKind != JsonValueKind.Array || point.GetArrayLength() < 2 ||
                point[0].ValueKind != JsonValueKind.Number || point[1].ValueKind != JsonValueKind.Number)
            {
                return null;
            }

            points.Add(project(point[0].GetDouble(), point[1].GetDouble()));
        }

        return points;
    }

    private static List<List<Coordinate>> Chain(List<List<Coordinate>> parts)
    {
        var remaining = parts.OrderByDescending(LengthMetres).ToList();
        var lines = new List<List<Coordinate>>();

        while (remaining.Count > 0)
        {
            var line = remaining[0];
            remaining.RemoveAt(0);

            while (remaining.Count > 0)
            {
                var (index, atLineEnd, atPartEnd, distance) = remaining
                    .SelectMany((part, i) => new[]
                    {
                        (i, true, false, TrailLength.Haversine(line[^1], part[0])),
                        (i, true, true, TrailLength.Haversine(line[^1], part[^1])),
                        (i, false, false, TrailLength.Haversine(line[0], part[0])),
                        (i, false, true, TrailLength.Haversine(line[0], part[^1])),
                    })
                    .MinBy(c => c.Item4);

                if (distance > JoinToleranceMetres)
                    break;

                var next = remaining[index];
                remaining.RemoveAt(index);

                if (atLineEnd == atPartEnd)
                    next.Reverse();

                line = atLineEnd ? Join(line, next) : Join(next, line);
            }

            lines.Add(line);
        }

        // keep-comment: Holmsundsleden carries a 1.4 m part on a junction mid-line; a leftover that short is digitising noise, not a trail.
        return [.. lines.Where((line, i) => i == 0 || LengthMetres(line) >= JoinToleranceMetres)];
    }

    private static List<Coordinate> Join(List<Coordinate> first, List<Coordinate> second) =>
        [.. first, .. first[^1].Equals2D(second[0]) ? second.Skip(1) : second];

    private static double LengthMetres(List<Coordinate> points) =>
        points.Zip(points.Skip(1), TrailLength.Haversine).Sum();

    // The source writes id as a number and namn as a string, and leaves either out.
    private static string ReadString(JsonElement properties, string name) =>
        properties.TryGetProperty(name, out var value) && value.ValueKind is not JsonValueKind.Null
            ? value.ValueKind == JsonValueKind.String ? value.GetString() ?? string.Empty : value.GetRawText()
            : string.Empty;

    // keep-comment: each source spells id and name fields differently (Borås "id"/"namn", Naturvårdsverket "LED_ID"/"LEDNAMN" or "OBJECTID"/"STATLIGLEDNAMN", RUFS2050 "FID" with no name at all) — first one present wins.
    private static string ReadFirstString(JsonElement properties, params string[] names)
    {
        foreach (var name in names)
        {
            var value = ReadString(properties, name);

            if (value.Length > 0)
                return value;
        }

        return string.Empty;
    }
}
