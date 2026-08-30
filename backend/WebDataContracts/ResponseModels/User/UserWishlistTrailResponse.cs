// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;

namespace WebDataContracts.ResponseModels.User;

public class UserWishlistTrailResponse
{
    public required string Identifier { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal TrailLength { get; set; }
    public required string City { get; set; }
    public int? Classification { get; set; }
    public bool Accessibility { get; set; }
    public decimal? StartLatitude { get; set; }
    public decimal? StartLongitude { get; set; }
    public IReadOnlyCollection<RatingResponse>? RatingResponse { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImages { get; set; }

    public static UserWishlistTrailResponse Create(
        string identifier,
        string? name,
        decimal trailLength,
        string city,
        int? classification,
        bool accessibility,
        decimal? startLatitude,
        decimal? startLongitude,
        IEnumerable<RatingResponse>? ratingResponses,
        IEnumerable<TrailImageResponse>? trailImages
        )
    {
        return new UserWishlistTrailResponse
        {
            Identifier = identifier,
            Name = name ?? string.Empty,
            TrailLength = trailLength,
            City = city,
            Classification = classification,
            Accessibility = accessibility,
            StartLatitude = startLatitude,
            StartLongitude = startLongitude,
            RatingResponse = ratingResponses?.ToList(),
            TrailImages = trailImages?.ToList(),
        };
    }
}
