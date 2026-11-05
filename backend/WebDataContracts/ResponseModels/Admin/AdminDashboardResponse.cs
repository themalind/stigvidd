// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Admin;

public class AdminDashboardResponse
{
    public required int UserCount { get; set; }
    public required int NewUsersLast7Days { get; set; }
    public required int ReviewCount { get; set; }
    public required int ReviewsLast7Days { get; set; }
    public required IReadOnlyCollection<AdminDashboardReviewResponse> LatestReviews { get; set; }
}
