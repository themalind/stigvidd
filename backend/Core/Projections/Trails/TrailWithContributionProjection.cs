// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Trail;

namespace Core.Projections.Trails;

internal record TrailWithContributionProjection(TrailResponse Trail, TrailContributionResponse? Contribution);
