// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.CityAreas;

public record CityAreaProjection(
    string Identifier,
    string Name,
    string Location,
    string? Description,
    string? ImageUrl,
    string? Url,
    IReadOnlyCollection<CityAreaFacilityProjection> Facilities,
    IReadOnlyCollection<CityAreaTrailProjection> Trails);
