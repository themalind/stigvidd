// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminCityAreaPreviewTrailResponse
{
    public required string Identifier { get; set; }

    public required string Name { get; set; }

    // keep-comment: 0..1 of the trail's length inside the previewed boundary
    public required double ShareInside { get; set; }

    // keep-comment: [longitude, latitude] pairs, the GeoJSON order the admin map draws
    public required IReadOnlyList<double[]> Path { get; set; }
}
