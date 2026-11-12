// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminCityAreaBoundaryResponse
{
    // keep-comment: GeoJSON MultiPolygon coordinates, the same shape SaveCityAreaBoundaryRequest takes
    public required IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<double>>>> Coordinates { get; set; }
}
