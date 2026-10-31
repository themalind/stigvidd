// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

// A trimmed, simplified copy of the organizer's own hike, never a link to it. keep-comment: deleting the hike must not touch the event
public class EventRoute
{
    public int EventId { get; set; }
    public required LineString Path { get; set; }
    public int LengthMetres { get; set; }
    public Event? Event { get; set; }
}
