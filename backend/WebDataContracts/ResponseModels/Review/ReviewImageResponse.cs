// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Review;

public class ReviewImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }

    public static ReviewImageResponse Create(
        string presentableUrl,
        string identifier,
        string imageUrl
        )
    {
        return new ReviewImageResponse
        {
            Identifier = identifier,
            ImageUrl = $"{presentableUrl}{imageUrl}",
        };
    }
}

