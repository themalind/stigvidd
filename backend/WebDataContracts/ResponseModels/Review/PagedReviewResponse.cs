// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Review;

public class PagedReviewResponse
{
    public required IReadOnlyCollection<ReviewResponse> Reviews { get; set; }
    public bool HasMore { get; set; }
    public int Page { get; set; }
    public int? Total { get; set; }
}
