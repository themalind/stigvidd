// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using NetTopologySuite.Geometries;
using WebDataContracts.Enums;
using WebDataContracts.RequestModels.Event;

namespace Core.Services.Events;

// Turns the shared list query into the repository's search and order, and the last card into the next cursor. keep-comment: one place for feed and mine
public static class EventListing
{
    public static Coordinate? OriginOf(EventSearchQuery query)
    {
        return query.Lat.HasValue && query.Lon.HasValue
            ? new Coordinate((double)query.Lon.Value, (double)query.Lat.Value)
            : null;
    }

    public static EventSearch SearchOf(EventSearchQuery query)
    {
        var origin = OriginOf(query);
        var text = query.Search?.Trim();

        return new EventSearch(
            Text: string.IsNullOrEmpty(text) ? null : text.ToLowerInvariant(),
            From: UtcDates.ToUtc(query.From),
            To: UtcDates.ToUtc(query.To),
            Area: origin is not null && query.RadiusKm.HasValue
                ? new EventArea(origin.X, origin.Y, query.RadiusKm.Value * 1000.0)
                : null,
            OnlyWithSpots: query.OnlyWithSpots,
            MinLengthKm: query.MinLengthKm,
            MaxLengthKm: query.MaxLengthKm,
            RouteKind: query.RouteKind);
    }

    // False for a cursor that does not decode, or that belongs to the other sort. keep-comment: the caller answers 400
    public static bool TryOrderOf(EventSearchQuery query, bool newestFirst, out EventOrder order)
    {
        var origin = OriginOf(query);

        if (query.Sort == EventSort.Distance && origin is not null)
        {
            var decoded = EventCursor.TryDecodeDistance(query.Cursor, out var distanceKey);
            order = new EventsByDistance(origin.X, origin.Y, distanceKey);
            return decoded;
        }

        var valid = EventCursor.TryDecode(query.Cursor, out var startKey);
        order = new EventsByStart(newestFirst, startKey);
        return valid;
    }

    public static string NextCursor(EventOrder order, EventCard last)
    {
        return order switch
        {
            EventsByStart => EventCursor.Encode(new EventPageKey(last.StartsAt, last.Id)),
            EventsByDistance byDistance => EventCursor.EncodeDistance(new EventDistanceKey(
                LocalMetricProjection
                    .CentredOn(new Coordinate(byDistance.Longitude, byDistance.Latitude))
                    .SquaredMetresTo(new Coordinate(last.Longitude, last.Latitude)),
                last.Id)),
            _ => throw new ArgumentOutOfRangeException(nameof(order), order, "Unknown event order."),
        };
    }
}
