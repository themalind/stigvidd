// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class TrailOverviewResponse
{
    public required string Identifier { get; set; }
    public string? Name { get; set; }
    public decimal TrailLength { get; set; }
    public decimal AverageRating { get; set; }
    public IReadOnlyCollection<TrailImageResponse>? TrailImagesResponse { get; set; }

    public static TrailOverviewResponse Create(
        string identifier,
        string? name,
        decimal trailLength,
        decimal averageRating,
        IEnumerable<TrailImageResponse>? trailImages)
    {
        return new TrailOverviewResponse
        {
            Identifier = identifier,
            Name = name,
            TrailLength = trailLength,
            AverageRating = averageRating,
            TrailImagesResponse = trailImages?.ToList(),
        };
    }
}

