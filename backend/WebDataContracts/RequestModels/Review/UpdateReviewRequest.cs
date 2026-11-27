// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Review;

public class UpdateReviewRequest
{
    public decimal Rating { get; set; }
    public string? TrailReview { get; set; }
    public List<string>? RemovedImageIdentifiers { get; set; }
}
