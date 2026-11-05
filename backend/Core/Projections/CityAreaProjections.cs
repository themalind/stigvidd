// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections;

public record CityAreaProjection(
    string Identifier,
    string Name,
    string Location,
    string? Description,
    string? ImageUrl,
    string? Url,
    IReadOnlyCollection<CityAreaFacilityProjection> Facilities,
    IReadOnlyCollection<CityAreaTrailProjection> Trails);

public record CityAreaFacilityProjection(
    string Identifier,
    string Name,
    int FacilityType,
    bool IsAccessible,
    string? Location,
    string? Description,
    string? Url);

public record CityAreaTrailProjection(
    string Identifier,
    string Name,
    decimal TrailLength,
    int Classification,
    string? Description,
    decimal AverageRating,
    CityAreaTrailImageProjection? Image);

public record CityAreaTrailImageProjection(
    string Identifier,
    string ImageUrl);
