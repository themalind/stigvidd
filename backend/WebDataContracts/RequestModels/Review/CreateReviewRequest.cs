// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Review;

public class CreateReviewRequest
{
    public decimal Rating { get; set; }
    public string? TrailReview { get; set; }
    public required string TrailIdentifier { get; set; }
}
