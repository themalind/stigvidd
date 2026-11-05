// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Projections.HikeShares;

public class SentHikeShare
{
    public required string HikeIdentifier { get; init; }
    public required string HikeName { get; init; }
    public decimal HikeLength { get; init; }
    public int Duration { get; init; }
    public required LineString GeoPath { get; init; }
    public bool IsOwnHike { get; init; }
    public string? ImageUrl { get; init; }
    public required List<SentHikeShareRecipient> Recipients { get; init; }
}
