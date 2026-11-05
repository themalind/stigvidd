// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json.Serialization;

namespace WebDataContracts.RequestModels.Facility;

// keep-comment: the whole facility on every save; a missing or unknown property is a 400, never a silent partial write
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class SaveFacilityRequest
{
    public required string Name { get; init; }
    public required int FacilityType { get; init; }
    public required bool IsAccessible { get; init; }
    // keep-comment: both null = no point on the map (fishing, swimming and nature areas are reached through their area)
    public required decimal? Latitude { get; init; }
    public required decimal? Longitude { get; init; }
    public required string Location { get; init; }
    public required string Description { get; init; }
    public required string Url { get; init; }
}
