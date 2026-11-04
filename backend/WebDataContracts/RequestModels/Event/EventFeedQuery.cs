// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventFeedQuery
{
    public const int DefaultLimit = 20;
    public const int MaxLimit = 50;
    public const int MaxRadiusKm = 200;

    public string? Trail { get; set; }
    public string? Organizer { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lon { get; set; }
    public int? RadiusKm { get; set; }
    public int Limit { get; set; } = DefaultLimit;
    public string? Cursor { get; set; }

    // Leaves out events the signed-in viewer is part of, which the app lists under Mina. keep-comment: what the flag drops
    public bool ExcludeMine { get; set; }
}
