// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.RequestModels.Event;

public abstract class EventSearchQuery
{
    public const int DefaultLimit = 20;
    public const int MaxLimit = 50;
    public const int MaxRadiusKm = 200;
    public const int MaxSearchLength = 100;
    public const int LengthKmCeiling = 1000;

    // Matches title, place, meeting point, trail name and organizer. keep-comment: the fields searched
    public string? Search { get; set; }

    // From inclusive, To exclusive, both on the start time. keep-comment: the bounds
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }

    public decimal? Lat { get; set; }
    public decimal? Lon { get; set; }
    public int? RadiusKm { get; set; }

    public bool OnlyWithSpots { get; set; }
    public decimal? MinLengthKm { get; set; }
    public decimal? MaxLengthKm { get; set; }
    public EventRouteKind? RouteKind { get; set; }

    public EventSort Sort { get; set; } = EventSort.Date;
    public int Limit { get; set; } = DefaultLimit;
    public string? Cursor { get; set; }
}
