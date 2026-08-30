// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Hike;

public class UpdateHikeRequest
{
    public string? Name { get; set; }
    public string? ParkingInfo { get; set; }
    public string? GettingThere { get; set; }
    public string? Description { get; set; }
}
