// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Interfaces.Repositories.CityAreas.Models;

public record CityAreaTrailProjection(
    string Identifier,
    string Name,
    decimal TrailLength,
    int Classification,
    string? Description,
    decimal AverageRating,
    CityAreaTrailImageProjection? Image,
    bool IsAccessible,
    // keep-comment: only the single-area query loads it; the list leaves it null
    LineString? Path);
