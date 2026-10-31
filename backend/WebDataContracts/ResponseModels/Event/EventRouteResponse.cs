// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventRouteResponse
{
    public const string Trail = "Trail";
    public const string Own = "Own";

    public required string Kind { get; set; }
    public int? LengthMeters { get; set; }
    // Own routes only; a trail's path comes from the trail endpoint, as on the trail page. keep-comment: why Coordinates is null for a trail
    public string? Coordinates { get; set; }
}
