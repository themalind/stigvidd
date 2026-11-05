// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using System.Linq.Expressions;
using WebDataContracts.Enums;

namespace Core.Repositories.Events;

public static class EventFilters
{
    public static IQueryable<Event> Matching(this IQueryable<Event> events, EventSearch search)
    {
        if (search.Text is not null)
            events = events.Where(ContainsText(search.Text));

        if (search.From is not null)
        {
            var from = search.From.Value;
            events = events.Where(e => e.StartsAt >= from);
        }

        if (search.To is not null)
        {
            var to = search.To.Value;
            events = events.Where(e => e.StartsAt < to);
        }

        if (search.Area is not null)
            events = new EventDistance(search.Area.Longitude, search.Area.Latitude).Within(events, search.Area.RadiusMeters);

        if (search.OnlyWithSpots)
            events = events.Where(e => e.MaxParticipants == null || e.ParticipantCount < e.MaxParticipants);

        if (search.MinLengthKm is not null)
        {
            var minKm = search.MinLengthKm.Value;
            var minMetres = (double)minKm * 1000;
            events = events.Where(e => e.Trail != null
                ? e.Trail.TrailLength >= minKm
                : e.Route != null && e.Route.LengthMetres >= minMetres);
        }

        if (search.MaxLengthKm is not null)
        {
            var maxKm = search.MaxLengthKm.Value;
            var maxMetres = (double)maxKm * 1000;
            events = events.Where(e => e.Trail != null
                ? e.Trail.TrailLength <= maxKm
                : e.Route != null && e.Route.LengthMetres <= maxMetres);
        }

        if (search.RouteKind == EventRouteKind.Trail)
            events = events.Where(e => e.Trail != null);

        if (search.RouteKind == EventRouteKind.Own)
            events = events.Where(e => e.Trail == null && e.Route != null);

        return events;
    }

    public static IQueryable<Event> InOrder(this IQueryable<Event> events, EventOrder order)
    {
        return order switch
        {
            EventsByStart byStart => ByStart(events, byStart),
            EventsByDistance byDistance => new EventDistance(byDistance.Longitude, byDistance.Latitude).NearestFirst(events, byDistance.After),
            _ => throw new ArgumentOutOfRangeException(nameof(order), order, "Unknown event order."),
        };
    }

    // ToLower on both sides: LIKE differs between Postgres and SQLite, and ILike throws on SQLite. keep-comment: see MailOutboxRepository
    private static Expression<Func<Event, bool>> ContainsText(string text)
    {
        return e => e.Title.ToLower().Contains(text)
            || (e.LocationName != null && e.LocationName.ToLower().Contains(text))
            || (e.MeetingPointName != null && e.MeetingPointName.ToLower().Contains(text))
            || (e.Trail != null && e.Trail.Name.ToLower().Contains(text))
            || e.Participants.Any(p => p.Role == EventParticipantRole.Organizer
                && p.User != null
                && p.User.NickName.ToLower().Contains(text));
    }

    private static IQueryable<Event> ByStart(IQueryable<Event> events, EventsByStart order)
    {
        if (order.After is not null)
        {
            var startsAt = order.After.At;
            var id = order.After.Id;

            events = order.Descending
                ? events.Where(e => e.StartsAt < startsAt || (e.StartsAt == startsAt && e.Id < id))
                : events.Where(e => e.StartsAt > startsAt || (e.StartsAt == startsAt && e.Id > id));
        }

        return order.Descending
            ? events.OrderByDescending(e => e.StartsAt).ThenByDescending(e => e.Id)
            : events.OrderBy(e => e.StartsAt).ThenBy(e => e.Id);
    }
}
