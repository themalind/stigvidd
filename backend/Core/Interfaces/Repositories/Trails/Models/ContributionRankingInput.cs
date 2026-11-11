// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Trails.Models;

public record ContributionRankingInput(
    string Identifier,
    IReadOnlyCollection<RankedReview> Reviews,
    IReadOnlyCollection<DateTime> LikedAt,
    double StartLatitude,
    double StartLongitude);
