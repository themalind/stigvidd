// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Facility;

public class UpdateFacilityRequest
{
    public string? Name { get; set; }
    public int? FacilityType { get; set; }
    public bool? IsAccessible { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Location { get; set; }
    public string? Description { get; set; }
    public string? Url { get; set; }
}
