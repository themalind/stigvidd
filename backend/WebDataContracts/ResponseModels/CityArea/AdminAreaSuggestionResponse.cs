// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminAreaSuggestionResponse
{
    public required string AreaIdentifier { get; set; }
    public required string AreaName { get; set; }
    public required AreaSuggestionReason Reason { get; set; }
    public required double? DistanceKm { get; set; }
    public required string? NearestName { get; set; }
}
