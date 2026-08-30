// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Review;

public class RatingResponse
{
    public required string Identifier { get; set; } // ReviewIdentifier
    public decimal Rating { get; set; }

    public static RatingResponse Create(
        string identifier,
        decimal rating)
    {
        return new RatingResponse
        {
            Identifier = identifier,
            Rating = rating,
        };
    }
}
