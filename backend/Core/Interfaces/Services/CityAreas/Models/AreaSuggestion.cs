// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace Core.Interfaces.Services.CityAreas.Models;

public record AreaSuggestion(
    string AreaIdentifier, string AreaName, AreaSuggestionReason Reason, double? DistanceKm, string? NearestName);
