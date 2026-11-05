// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminCityAreaResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Location { get; set; }
    public required IReadOnlyCollection<AdminCityAreaFacilityResponse> Facilities { get; set; }
    public required IReadOnlyCollection<AdminCityAreaTrailResponse> Trails { get; set; }
}
