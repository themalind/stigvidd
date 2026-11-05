// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.CityAreas;

public record CityAreaFacilityProjection(
    string Identifier,
    string Name,
    int FacilityType,
    bool IsAccessible,
    string? Location,
    string? Description,
    string? Url);
