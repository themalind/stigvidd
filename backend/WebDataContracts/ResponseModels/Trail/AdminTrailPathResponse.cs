// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class AdminTrailPathResponse
{
    // [longitude, latitude] pairs, the order GeoJSON uses. keep-comment: the pair order is not visible from the type
    public required IReadOnlyList<double[]> Coordinates { get; set; }

    public static AdminTrailPathResponse Create(IReadOnlyList<double[]> coordinates) =>
        new() { Coordinates = coordinates };
}
