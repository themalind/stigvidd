// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Trails.Models;

internal record TrailShortInfoProjection(
    string Identifier, string Name, decimal TrailLength, bool Accessibility,
    int? Classification, string City, decimal AverageRating,
    decimal? StartLatitude, decimal? StartLongitude, bool IsContribution);
