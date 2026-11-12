// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json;
using Infrastructure.Enums;

namespace Core.Interfaces.Services.Facilities.Models;

public record FacilityImportMapping(
    string? IdField,
    string NameField,
    string? DescriptionField,
    string? UrlField,
    string? TypeField,
    FacilityType FixedType,
    IReadOnlyDictionary<string, FacilityType> TypeValues)
{
    public string ToJson()
    {
        return JsonSerializer.Serialize(this);
    }

    public static FacilityImportMapping? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            return JsonSerializer.Deserialize<FacilityImportMapping>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
