// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json.Serialization;

namespace WebDataContracts.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FacilityImportField
{
    Name,
    Description,
    Url,
    Coordinates,
    // keep-comment: its values travel as the FacilityType flags in decimal, such as "3"
    Type,
}
