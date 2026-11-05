// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Services.CityAreas;

public record SuggestedFacility(UnlinkedFacilityProjection Facility, IReadOnlyList<AreaSuggestion> Suggestions);
