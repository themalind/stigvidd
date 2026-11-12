// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using System.Text.Json;
using Infrastructure.Enums;

namespace Core.Interfaces.Services.Facilities.Models;

// keep-comment: Type is null in a baseline saved before types were recorded
public record FacilitySourceSnapshot(string Name, string? Description, string? Url, string Coordinates, FacilityType? Type = null)
{
    public static FacilitySourceSnapshot From(SourceFacility site)
    {
        return new FacilitySourceSnapshot(site.Name, site.Description, site.Url, FormatCoordinates(site.Longitude, site.Latitude), site.Type);
    }

    public static FacilitySourceSnapshot? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            return JsonSerializer.Deserialize<FacilitySourceSnapshot>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public string ToJson()
    {
        return JsonSerializer.Serialize(this);
    }

    public bool TryPoint(out double longitude, out double latitude)
    {
        longitude = 0;
        latitude = 0;
        var parts = Coordinates.Split(',', StringSplitOptions.TrimEntries);

        return parts.Length == 2
            && double.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out latitude)
            && double.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out longitude);
    }

    // keep-comment: six decimals is ~0.1 m, so float noise between exports never reads as a move
    public static string FormatCoordinates(double longitude, double latitude)
    {
        return string.Create(CultureInfo.InvariantCulture, $"{latitude:F6}, {longitude:F6}");
    }
}
