// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminCityAreaBoundaryPreviewResponse
{
    public required IReadOnlyList<AdminCityAreaPreviewTrailResponse> AddedTrails { get; set; }

    public required IReadOnlyList<AdminCityAreaPreviewTrailResponse> RemovedTrails { get; set; }

    public required IReadOnlyList<AdminCityAreaPreviewFacilityResponse> AddedFacilities { get; set; }

    public required IReadOnlyList<AdminCityAreaPreviewFacilityResponse> RemovedFacilities { get; set; }
}
