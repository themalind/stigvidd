// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Admin;

public class AdminDashboardResponse
{
    public int UserCount { get; set; }
    public int NewUsersLast7Days { get; set; }
    public int ReviewCount { get; set; }
    public int ReviewsLast7Days { get; set; }
    public required IReadOnlyCollection<AdminDashboardReviewResponse> LatestReviews { get; set; }
}

public class AdminDashboardReviewResponse
{
    public required string Identifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public required string TrailName { get; set; }
    public decimal Rating { get; set; }
    public string? Text { get; set; }
    public string? AuthorNickName { get; set; }
    public int ImageCount { get; set; }
    public bool IsHidden { get; set; }
    public DateTime CreatedAt { get; set; }
}
