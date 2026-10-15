// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Factories;

public class HikeResponseFactory
{
    public string PresentableBaseUrl { get; }

    public HikeResponseFactory(IConfiguration configuration)
    {
        PresentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public HikeResponse Create(Hike hike)
    {
        return HikeResponse.Create(
            hike.Identifier,
            hike.Name,
            hike.HikeLength,
            hike.Duration,
            GeoPathSerializer.ToCoordinateJson(hike.GeoPath),
            hike.CreatedBy ?? string.Empty,
            hike.GettingThere,
            hike.ParkingInfo,
            hike.Description,
            hike.CreatedAt,
            hike.CreatedByNickName,
            CreateImages(PresentableBaseUrl, hike.Images)
        );
    }

    // keep-comment: static and null-tolerant because EF top-level projections call it client-side with the materialized navigation
    public static List<HikeImageResponse> CreateImages(string presentableBaseUrl, IEnumerable<HikeImage>? images)
    {
        return images?
            .Where(i => i.ModerationState == ModerationState.Visible)
            .OrderBy(i => i.CreatedAt)
            .Select(i => HikeImageResponse.Create(presentableBaseUrl, i.Identifier, i.ImageUrl))
            .ToList() ?? [];
    }
}
