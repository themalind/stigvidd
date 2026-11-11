// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.CityAreas.Models;

public record CityAreaTrailProjection(
    string Identifier,
    string Name,
    decimal TrailLength,
    int Classification,
    string? Description,
    decimal AverageRating,
    CityAreaTrailImageProjection? Image);
