// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using NetTopologySuite.Geometries;

namespace Core.Repositories.Events;

// Squared metres on LocalMetricProjection's plane, equirectangular as in TrailRepository. keep-comment: translates on Npgsql, SpatiaLite and InMemory alike
public sealed class EventDistance
{
    private readonly LocalMetricProjection _projection;
    private readonly double _longitude;
    private readonly double _latitude;

    public EventDistance(double longitude, double latitude)
    {
        _longitude = longitude;
        _latitude = latitude;
        _projection = LocalMetricProjection.CentredOn(new Coordinate(longitude, latitude));
    }

    // The box uses the GiST index; the metre check trims its corners. keep-comment: why both
    public IQueryable<Event> Within(IQueryable<Event> events, double radiusMetres)
    {
        var halfWidth = radiusMetres / _projection.MetresPerDegreeLongitude;
        var halfHeight = radiusMetres / _projection.MetresPerDegreeLatitude;

        var box = GeoPointFactory.FromLonLatEnvelope(new Envelope(
            _longitude - halfWidth,
            _longitude + halfWidth,
            Math.Max(-90, _latitude - halfHeight),
            Math.Min(90, _latitude + halfHeight)));

        var radiusSquared = radiusMetres * radiusMetres;

        return Measure(events.Where(e => e.Location.Intersects(box)))
            .Where(m => m.SquaredMetres <= radiusSquared)
            .Select(m => m.Event);
    }

    public IQueryable<Event> NearestFirst(IQueryable<Event> events, EventDistanceKey? after)
    {
        var measured = Measure(events);

        if (after is not null)
        {
            var squaredMetres = after.SquaredMetres;
            var id = after.Id;
            measured = measured.Where(m => m.SquaredMetres > squaredMetres || (m.SquaredMetres == squaredMetres && m.Event.Id > id));
        }

        return measured
            .OrderBy(m => m.SquaredMetres)
            .ThenBy(m => m.Event.Id)
            .Select(m => m.Event);
    }

    // LocalMetricProjection.SquaredMetresTo in SQL, operation for operation, so a cursor key matches. keep-comment: why the formula is written twice
    private IQueryable<MeasuredEvent> Measure(IQueryable<Event> events)
    {
        var originLongitude = _longitude;
        var originLatitude = _latitude;
        var metresPerDegreeLongitude = _projection.MetresPerDegreeLongitude;
        var metresPerDegreeLatitude = _projection.MetresPerDegreeLatitude;

        return events.Select(e => new MeasuredEvent
        {
            Event = e,
            SquaredMetres =
                (((e.Location.X - originLongitude) * metresPerDegreeLongitude) * ((e.Location.X - originLongitude) * metresPerDegreeLongitude))
                + (((e.Location.Y - originLatitude) * metresPerDegreeLatitude) * ((e.Location.Y - originLatitude) * metresPerDegreeLatitude)),
        });
    }

    private sealed class MeasuredEvent
    {
        public required Event Event { get; init; }
        public double SquaredMetres { get; init; }
    }
}
