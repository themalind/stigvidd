// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class TrailCardResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public decimal TrailLength { get; set; }
    public int Classification { get; set; }
    public bool IsAccessible { get; set; }
    public decimal AverageRating { get; set; }
    public TrailImageResponse? Image { get; set; }
    public TrailContributionResponse? Contribution { get; set; }

    public static TrailCardResponse Create(
        string identifier,
        string name,
        decimal trailLength,
        int classification,
        bool isAccessible,
        decimal averageRating,
        TrailImageResponse? image,
        TrailContributionResponse? contribution = null)
    {
        return new TrailCardResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            Classification = classification,
            IsAccessible = isAccessible,
            AverageRating = averageRating,
            Image = image,
            Contribution = contribution
        };
    }
}
