// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections;

public record AdminCityAreaProjection(
    string Identifier,
    string Name,
    string Location,
    IReadOnlyCollection<AdminCityAreaFacilityProjection> Facilities,
    IReadOnlyCollection<AdminCityAreaTrailProjection> Trails);
