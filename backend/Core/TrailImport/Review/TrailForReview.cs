// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Source;
using NetTopologySuite.Geometries;

namespace Core.TrailImport.Review;

// The trail a proposal points at, as the review view needs to see it: enough to draw it
// beside the feature and to judge whether the curated length still holds.
public sealed record TrailForReview(
    int TrailId,
    string Identifier,
    string Name,
    decimal TrailLength,
    bool IsVerified,
    LineString? GeoPath);
