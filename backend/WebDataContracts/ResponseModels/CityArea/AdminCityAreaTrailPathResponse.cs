// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminCityAreaTrailPathResponse
{
    public required string Identifier { get; set; }

    // keep-comment: [longitude, latitude] pairs, the GeoJSON order the admin map draws
    public required IReadOnlyList<double[]> Path { get; set; }
}
