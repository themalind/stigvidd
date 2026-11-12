// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.CityArea;

public class SaveCityAreaBoundaryRequest
{
    // keep-comment: GeoJSON MultiPolygon coordinates: polygons, their rings (outer first), positions as [longitude, latitude]
    public List<List<List<List<double>>>> Coordinates { get; set; } = [];
}
