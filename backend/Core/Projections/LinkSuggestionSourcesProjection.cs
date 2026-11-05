// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections;

public record LinkSuggestionSourcesProjection(
    IReadOnlyCollection<SuggestionAreaProjection> Areas,
    IReadOnlyCollection<UnlinkedFacilityProjection> Facilities,
    IReadOnlyCollection<UnlinkedTrailProjection> Trails);
