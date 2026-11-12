// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.CityAreas.Models;

public record BoundaryPreviewProjection(
    IReadOnlyList<PreviewTrailProjection> AddedTrails,
    IReadOnlyList<PreviewTrailProjection> RemovedTrails,
    IReadOnlyList<PreviewFacilityProjection> AddedFacilities,
    IReadOnlyList<PreviewFacilityProjection> RemovedFacilities);
