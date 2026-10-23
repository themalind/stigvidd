// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Trail;

namespace Core.Projections;

internal record TrailWithContributionProjection(TrailResponse Trail, TrailContributionResponse? Contribution);

internal record TrailCardProjection(
    string Identifier, string Name, decimal TrailLength,
    int Classification, bool Accessibility, decimal AverageRating,
    TrailCardImageProjection? Image, TrailContributionResponse? Contribution = null);

internal record TrailCardImageProjection(string Identifier, string ImageUrl);

internal record TrailMarkerProjection(
    string Identifier, string Name, bool IsAccessible,
    decimal? StartLatitude, decimal? StartLongitude, bool IsContribution = false);

internal record TrailShortInfoProjection(
    string Identifier, string Name, decimal TrailLength, bool Accessibility,
    int? Classification, string City, decimal AverageRating,
    decimal? StartLatitude, decimal? StartLongitude, bool IsContribution);

internal record TrailOverviewProjection(
    string Identifier, string Name, decimal TrailLength, decimal AverageRating,
    TrailCardImageProjection? Image);
