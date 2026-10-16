// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Spatial;

public static class CoordinatePathParser
{
    // keep-comment: the app caps a recording at 12 h sampled every ~3 s (~14,400 points)
    public const int MaxCoordinates = 20_000;

    public static LineString? TryParse(string json)
    {
        WebDataContracts.Coordinate[]? parsed;

        try
        {
            parsed = Newtonsoft.Json.JsonConvert.DeserializeObject<WebDataContracts.Coordinate[]>(json);
        }
        catch (Newtonsoft.Json.JsonException)
        {
            return null;
        }

        if (parsed is null || parsed.Length < 2 || parsed.Length > MaxCoordinates)
            return null;

        if (parsed.Any(c =>
                !double.IsFinite(c.Latitude) || !double.IsFinite(c.Longitude) ||
                c.Latitude < -90 || c.Latitude > 90 ||
                c.Longitude < -180 || c.Longitude > 180))
            return null;

        return GeoPointFactory.FromLonLatPath(parsed.Select(c => new Coordinate(c.Longitude, c.Latitude)));
    }
}
