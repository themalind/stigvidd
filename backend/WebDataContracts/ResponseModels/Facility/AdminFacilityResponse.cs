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
}
