// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.CityAreas;

public record SuggestionAreaProjection(string Identifier, string Name, IReadOnlyCollection<LinkedPlaceProjection> Places);
