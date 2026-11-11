// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Trail;

namespace Core.Interfaces.Repositories.Trails.Models;

internal record TrailCardProjection(
    string Identifier, string Name, decimal TrailLength,
    int Classification, bool Accessibility, decimal AverageRating,
    TrailCardImageProjection? Image, TrailContributionResponse? Contribution = null);
