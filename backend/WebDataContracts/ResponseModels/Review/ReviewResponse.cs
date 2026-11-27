// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Review;

public class ReviewResponse
{
    public required string Identifier { get; set; }
    public string? TrailReview { get; set; }
    public decimal Rating { get; set; }
    // Both null once the author has deleted their account. keep-comment: not visible from the types
    public string? UserName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }
    public string? UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
    public IReadOnlyCollection<ReviewImageResponse>? ReviewImages { get; set; }

    public static ReviewResponse Create(
        string identifier,
        string? trailReview,
        decimal rating,
        string? username,
        DateTime createdAt,
        DateTime? editedAt,
        string trailIdentifier,
        string? userIdentifier,
        IEnumerable<ReviewImageResponse>? reviewImages)
    {
        return new ReviewResponse
        {
            Identifier = identifier,
            TrailReview = trailReview,
            Rating = rating,
            UserName = username,
            CreatedAt = createdAt,
            EditedAt = editedAt,
            TrailIdentifier = trailIdentifier,
            UserIdentifier = userIdentifier,
            ReviewImages = reviewImages?.ToList(),
        };
    }
}
