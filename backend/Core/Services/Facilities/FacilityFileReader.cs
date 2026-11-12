// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using System.Text.Json;
using Core.Validators.Facilities;
using Infrastructure.Enums;

namespace Core.Services.Facilities;

public static class FacilityFileReader
{
    // keep-comment: Facility.SourceId holds 200 characters: a data source key of up to 101, a colon and the id
    public const int MaxIdLength = 98;

    // keep-comment: marks a source id made from a position, for files whose features have no stable id
    public const string PositionIdPrefix = "@";

    private static readonly string[] Wgs84CrsNames = ["CRS84", "4326"];

    public static Result<FacilityFile> Read(string geoJson, string sourceName, FacilityImportMapping mapping)
    {
        try
        {
            using var document = JsonDocument.Parse(geoJson);

            return ReadDocument(document.RootElement, sourceName, mapping);
        }
        catch (JsonException)
        {
            return Fail("The file is not valid GeoJSON.");
        }
    }

    private static Result<FacilityFile> ReadDocument(JsonElement root, string sourceName, FacilityImportMapping mapping)
    {
        // keep-comment: a projected export such as SWEREF99 TM (EPSG:3006) would otherwise be stored as degrees
        if (CrsName(root) is { } crs && !Wgs84CrsNames.Any(name => crs.Contains(name, StringComparison.Ordinal)))
            return Fail($"The file uses the coordinate system {crs}. Export it as WGS84 (EPSG:4326).");

        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("features", out var features)
            || features.ValueKind != JsonValueKind.Array)
        {
            return Fail("The file has no features.");
        }

        var sites = new List<SourceFacility>();
        var notes = new List<string>();
        var usedIds = new HashSet<string>(StringComparer.Ordinal);

        foreach (var feature in features.EnumerateArray())
        {
            if (!feature.TryGetProperty("properties", out var properties)
                || properties.ValueKind != JsonValueKind.Object
                || !TryPoint(feature, out var longitude, out var latitude)
                || Value(properties, mapping.NameField) is not { } rawName)
            {
                continue;
            }

            if (longitude is < -180 or > 180 || latitude is < -90 or > 90)
                return Fail($"{rawName} has coordinates outside WGS84. Export the file as WGS84 (EPSG:4326), not SWEREF99.");

            var typeValue = mapping.TypeField is { } typeField ? TypeKey(properties, typeField) : null;
            FacilityType type;

            if (typeValue is null)
                type = mapping.FixedType;
            else if (!mapping.TypeValues.TryGetValue(typeValue, out type))
                return Fail($"\"{(typeValue.Length == 0 ? "(empty)" : typeValue)}\" in {mapping.TypeField} has no facility type. Choose one or leave it out.");

            if (type == FacilityType.None)
                continue;

            string id;

            if (mapping.IdField is { } idField)
            {
                if (Value(properties, idField) is not { } value)
                    return Fail($"{rawName} has no {idField}. Choose another id field, or match on position.");

                if (value.Length > MaxIdLength)
                    return Fail($"An id in {idField} is longer than {MaxIdLength} characters.");

                if (usedIds.Contains(value))
                    return Fail($"{idField} is not unique: {value} is used by more than one point. Choose another id field, or match on position.");

                id = value;
            }
            else
            {
                id = UniqueId(PositionId(longitude, latitude), usedIds);
            }

            usedIds.Add(id);
            var name = Shorten(rawName, FacilityRules.NameMaxLength, $"The name of {rawName}", notes);
            var description = mapping.DescriptionField is { } descriptionField && Value(properties, descriptionField) is { } rawDescription
                ? Shorten(rawDescription, FacilityRules.DescriptionMaxLength, $"The description of {name}", notes)
                : null;
            var url = mapping.UrlField is { } urlField ? WebAddress(Value(properties, urlField), name, notes) : null;

            sites.Add(new SourceFacility($"{sourceName}:{id}", name, description, url, longitude, latitude, type));
        }

        if (sites.Count == 0)
            return Fail($"No feature in the file has a {mapping.NameField}, a point and a facility type.");

        return Result.Ok(new FacilityFile(sites, notes));
    }

    public static string PositionId(double longitude, double latitude)
    {
        return string.Create(CultureInfo.InvariantCulture, $"{PositionIdPrefix}{latitude:F5},{longitude:F5}");
    }

    // keep-comment: the limits a facility edited in admin has, so an imported one can still be saved there
    private static string Shorten(string value, int max, string what, List<string> notes)
    {
        if (value.Length <= max)
            return value;

        notes.Add($"{what} is cut to {max} characters.");

        return value[..max].TrimEnd();
    }

    private static string? WebAddress(string? url, string name, List<string> notes)
    {
        if (url is null)
            return null;

        if (url.Length <= FacilityRules.UrlMaxLength && FacilityRules.IsEmptyOrAbsoluteHttpUrl(url))
            return url;

        notes.Add($"The link of {name} is left out: \"{url}\" is not a full web address.");

        return null;
    }

    // keep-comment: "id", then "id#2", "id#3"; two features at the same rounded position, such as a fire pit beside a shelter, still get their own ids
    public static string UniqueId(string id, IReadOnlySet<string> takenIds)
    {
        var unique = id;

        for (var n = 2; takenIds.Contains(unique); n++)
            unique = $"{id}#{n}";

        return unique;
    }

    private static bool TryPoint(JsonElement feature, out double longitude, out double latitude)
    {
        longitude = 0;
        latitude = 0;

        if (!feature.TryGetProperty("geometry", out var geometry)
            || geometry.ValueKind != JsonValueKind.Object
            || Value(geometry, "type") != "Point"
            || !geometry.TryGetProperty("coordinates", out var coordinates)
            || coordinates.ValueKind != JsonValueKind.Array
            || coordinates.GetArrayLength() < 2
            || coordinates[0].ValueKind != JsonValueKind.Number
            || coordinates[1].ValueKind != JsonValueKind.Number)
        {
            return false;
        }

        longitude = coordinates[0].GetDouble();
        latitude = coordinates[1].GetDouble();

        return true;
    }

    private static string? CrsName(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("crs", out var crs)
            || crs.ValueKind != JsonValueKind.Object
            || !crs.TryGetProperty("properties", out var properties))
        {
            return null;
        }

        return Value(properties, "name");
    }

    // keep-comment: a number reads as its shortest form (1.0 as 1), the way the admin page lists the values; a missing value is ""
    private static string TypeKey(JsonElement properties, string field)
    {
        if (properties.TryGetProperty(field, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number))
            return number.ToString(CultureInfo.InvariantCulture);

        return Value(properties, field) ?? "";
    }

    // keep-comment: a number counts as text, so a numeric id or code reads the same as a quoted one
    private static string? Value(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(property, out var value))
            return null;

        var text = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString()?.Trim(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };

        return string.IsNullOrEmpty(text) ? null : text;
    }

    private static Result<FacilityFile> Fail(string message)
    {
        return Result.Fail<FacilityFile>(new Message(400, message));
    }
}
