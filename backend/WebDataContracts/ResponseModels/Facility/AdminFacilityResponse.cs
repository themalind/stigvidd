// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Facility;

// keep-comment: the shape SaveFacilityRequest takes back, so the admin form round-trips without defaults
public class AdminFacilityResponse
{
    public required string Identifier { get; init; }
    public required string Name { get; init; }
    public required int FacilityType { get; init; }
    public required bool IsAccessible { get; init; }
    // keep-comment: null when the facility has no point, unlike FacilityResponse's 0/0
    public required decimal? Latitude { get; init; }
    public required decimal? Longitude { get; init; }
    public required string Location { get; init; }
    public required string Description { get; init; }
    public required string Url { get; init; }
    // keep-comment: "<source key>:<the source's id>" for an imported facility, null for one entered by hand
    public required string? SourceId { get; init; }
    // keep-comment: the data source part of SourceId, such as "boras:badplatser"
    public required string? SourceKey { get; init; }
    // keep-comment: facilities with the same non-empty key are likely the same place
    public required string NameKey { get; init; }
    public required IReadOnlyCollection<string> AreaNames { get; init; }
    public required DateTime LastUpdatedAt { get; init; }
}
