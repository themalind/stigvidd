// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.CityArea;

public class AdminUnlinkedFacilityResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required int FacilityType { get; set; }
    public required IReadOnlyCollection<AdminAreaSuggestionResponse> Suggestions { get; set; }
}
