// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Interfaces.Repositories.CityAreas.Models;

public record AdminCityAreaProjection(
    string Identifier,
    string Name,
    string Location,
    string? MunicipalityIdentifier,
    MultiPolygon? Boundary,
    IReadOnlyCollection<AdminCityAreaFacilityProjection> Facilities,
    IReadOnlyCollection<AdminCityAreaTrailProjection> Trails,
    IReadOnlyCollection<AdminCityAreaFacilityProjection> ExcludedFacilities,
    IReadOnlyCollection<AdminCityAreaTrailProjection> ExcludedTrails);
