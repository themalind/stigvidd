// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Hike;

namespace Core.Factories;

public class HikeResponseFactory
{
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
            hike.CreatedByNickName
        );
    }
}