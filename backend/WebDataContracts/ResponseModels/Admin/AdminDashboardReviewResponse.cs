// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Admin;

public class AdminDashboardReviewResponse
{
    public required string Identifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public required string TrailName { get; set; }
    public required decimal Rating { get; set; }
    public required string? Text { get; set; }
    public required string? AuthorNickName { get; set; }
    public required int ImageCount { get; set; }
    public required bool IsHidden { get; set; }
    public required DateTime CreatedAt { get; set; }
}
