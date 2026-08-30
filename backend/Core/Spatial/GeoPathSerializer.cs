// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json;
using NetTopologySuite.Geometries;

namespace Core.Spatial;

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

    // [longitude, latitude] pairs, the order GeoJSON uses and the review map draws.
    public static IReadOnlyList<double[]> ToCoordinatePairs(LineString line) =>
        line.Coordinates.Select(c => new[] { c.X, c.Y }).ToList();
}
