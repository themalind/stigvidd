// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.CityAreas.Models;

public record SuggestedTrail(UnlinkedTrailProjection Trail, IReadOnlyList<AreaSuggestion> Suggestions);
