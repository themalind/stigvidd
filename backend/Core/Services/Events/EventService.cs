// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services.Push;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Services.Events;

public class EventService : IEventService
{
    private readonly IEventRepository _eventRepository;
    private readonly EventLoader _loader;
    private readonly IUserBlockService _userBlockService;
    private readonly IPushQueue _pushQueue;
    private readonly IWebDavService _webDavService;
    private readonly EventResponseFactory _factory;
    private readonly EventLimits _limits;
    private readonly ILogger<EventService> _logger;

    public EventService(
        IEventRepository eventRepository,
        EventLoader loader,
        IUserBlockService userBlockService,
        IPushQueue pushQueue,
        IWebDavService webDavService,
        EventResponseFactory factory,
        IOptions<EventLimits> limits,
        ILogger<EventService> logger)
    {
        _eventRepository = eventRepository;
        _loader = loader;
        _userBlockService = userBlockService;
        _pushQueue = pushQueue;
        _webDavService = webDavService;
        _factory = factory;
        _limits = limits.Value;
        _logger = logger;
    }

    public async Task<Result<EventResponse>> CreateAsync(string userIdentifier, CreateEventRequest request, CancellationToken ctoken)
    {
        var viewer = await _loader.ResolveUserAsync(userIdentifier, ctoken);

        if (viewer.Message is not null)
            return Result.Fail<EventResponse>(viewer.Message);

        var now = DateTime.UtcNow;

        var upcoming = await _eventRepository.CountUpcomingAsOrganizerAsync(viewer.Value, now, ctoken);

        if (!upcoming.IsSuccess)
            return Result.Fail<EventResponse>(new Message(500, "An error occurred while counting your events."));

        if (upcoming.Value >= _limits.UpcomingAsOrganizer)
            return Result.Fail<EventResponse>(new Message(429, $"You can arrange at most {_limits.UpcomingAsOrganizer} upcoming events at a time.", EventErrorCodes.TooManyUpcoming));

        var today = await _eventRepository.CountCreatedSinceAsync(viewer.Value, now - _limits.CreatedPerDayWindow, ctoken);

        if (!today.IsSuccess)
            return Result.Fail<EventResponse>(new Message(500, "An error occurred while counting your events."));

        if (today.Value >= _limits.CreatedPerDay)
            return Result.Fail<EventResponse>(new Message(429, $"You can create at most {_limits.CreatedPerDay} events a day.", EventErrorCodes.TooManyToday));

        var place = await ResolvePlaceAsync(request, viewer.Value, currentTrailId: null, keptLocation: null, removeRoute: false, ctoken);

        if (place.Message is not null || place.Value is null)
            return Result.Fail<EventResponse>(place.Message ?? new Message(500, "No place was resolved."));

        var newEvent = new Event
        {
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            Location = place.Value.Location,
            Visibility = Enum.Parse<EventVisibility>(request.Visibility),
            AllowParticipantInvites = request.AllowParticipantInvites,
            Status = EventStatus.Published,
            ModerationState = ModerationState.Visible,
        };
        Apply(newEvent, request, place.Value);

        var created = await _eventRepository.CreateAsync(newEvent, viewer.Value, _limits.CreatedPerDayWindow, ctoken);

        if (!created.IsSuccess)
            return Result.Fail<EventResponse>(new Message(500, "An error occurred while creating the event."));

        return await GetAsync(userIdentifier, created.Value, ctoken);
    }

    public async Task<Result<EventPageResponse>> GetFeedAsync(string userIdentifier, EventFeedQuery query, CancellationToken ctoken)
    {
        if (!EventCursor.TryDecode(query.Cursor, out var after))
            return Result.Fail<EventPageResponse>(new Message(400, "Invalid cursor."));

        var viewer = await _loader.ResolveUserAsync(userIdentifier, ctoken);

        if (viewer.Message is not null)
            return Result.Fail<EventPageResponse>(viewer.Message);

        var hidden = await _userBlockService.GetHiddenUserIdsForReadAsync(viewer.Value, ctoken);
        var origin = query.Lat.HasValue && query.Lon.HasValue
            ? new Coordinate((double)query.Lon.Value, (double)query.Lat.Value)
            : null;
        var area = origin is not null && query.RadiusKm.HasValue
            ? new EventArea(origin.X, origin.Y, query.RadiusKm.Value * 1000.0)
            : null;

        var filter = new EventFeedFilter(
            viewer.Value,
            hidden,
            DateTime.UtcNow,
            query.Trail,
            query.Organizer,
            area,
            after,
            query.Limit + 1);

        var cards = await _eventRepository.GetFeedAsync(filter, ctoken);

        if (!cards.IsSuccess)
            return Result.Fail<EventPageResponse>(new Message(500, "An error occurred while fetching events."));

        return Result.Ok(Page(cards.Value, query.Limit, origin));
    }

    public async Task<Result<EventPageResponse>> GetMineAsync(string userIdentifier, MyEventsQuery query, CancellationToken ctoken)
    {
        if (!EventCursor.TryDecode(query.Cursor, out var after))
            return Result.Fail<EventPageResponse>(new Message(400, "Invalid cursor."));

        var viewer = await _loader.ResolveUserAsync(userIdentifier, ctoken);

        if (viewer.Message is not null)
            return Result.Fail<EventPageResponse>(viewer.Message);

        var hidden = await _userBlockService.GetHiddenUserIdsForReadAsync(viewer.Value, ctoken);
        var filter = new EventMineFilter(viewer.Value, hidden, DateTime.UtcNow, query.Past, after, query.Limit + 1);

        var cards = await _eventRepository.GetMineAsync(filter, ctoken);

        if (!cards.IsSuccess)
            return Result.Fail<EventPageResponse>(new Message(500, "An error occurred while fetching your events."));

        return Result.Ok(Page(cards.Value, query.Limit, origin: null));
    }

    public async Task<Result<EventResponse>> GetAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventResponse>(loaded.Message ?? EventErrors.Gone());

        var detail = loaded.Value.Detail;
        LineString? routePath = null;

        if (detail.RouteLengthMetres.HasValue)
        {
            var route = await _eventRepository.GetRoutePathAsync(detail.Event.Id, ctoken);

            if (!route.IsSuccess)
                return Result.Fail<EventResponse>(new Message(500, "An error occurred while fetching the route."));

            routePath = route.Value;
        }

        return Result.Ok(_factory.Create(detail, loaded.Value.Membership, loaded.Value.ShowOrganizer, routePath));
    }

    public async Task<Result<EventResponse>> UpdateAsync(string userIdentifier, string identifier, UpdateEventRequest request, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail<EventResponse>(loaded.Message ?? EventErrors.Gone());

        var current = loaded.Value.Detail.Event;
        var refusal = loaded.Value.Membership.EditRefusal();

        if (refusal is not null)
            return Result.Fail<EventResponse>(refusal);

        var now = DateTime.UtcNow;
        var startsAt = UtcDates.ToUtc(request.StartsAt);

        if (Moved(startsAt, current.StartsAt) && startsAt <= now)
            return Result.Fail<EventResponse>(new Message(400, "The event must start in the future."));

        var deadline = UtcDates.ToUtc(request.RegistrationDeadline);

        if (Moved(deadline, current.RegistrationDeadline) && deadline < now)
            return Result.Fail<EventResponse>(new Message(400, "RegistrationDeadline must not be in the past."));

        // An edit cannot end the event: a past event is frozen, so it would be a silent cancel. keep-comment: covers EndsAt moved back and EndsAt cleared
        if (PastAfterOf(startsAt, UtcDates.ToUtc(request.EndsAt)) <= now)
            return Result.Fail<EventResponse>(new Message(400, "The event must not end in the past."));

        var capacity = CapacityRefusal(current, request.MaxParticipants);

        if (capacity is not null)
            return Result.Fail<EventResponse>(capacity);

        var storedRoute = await StoredRouteStartAsync(loaded.Value.Detail, request, ctoken);

        if (storedRoute.Message is not null)
            return Result.Fail<EventResponse>(storedRoute.Message);

        var keptLocation = storedRoute.Value ?? (HasNoPlaceLeft(loaded.Value.Detail) ? current.Location : null);
        var place = await ResolvePlaceAsync(request, loaded.Value.ViewerId, current.TrailId, keptLocation, request.RemoveRoute, ctoken);

        if (place.Message is not null || place.Value is null)
            return Result.Fail<EventResponse>(place.Message ?? new Message(500, "No place was resolved."));

        var resolved = place.Value;
        var togglesInvites = loaded.Value.Membership.CanToggleParticipantInvites();
        var updated = await _eventRepository.UpdateAsync(identifier, e =>
        {
            e.Title = request.Title.Trim();
            e.Description = request.Description.Trim();
            Apply(e, request, resolved);

            if (togglesInvites)
                e.AllowParticipantInvites = request.AllowParticipantInvites;
        }, ctoken);

        if (updated.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<EventResponse>(EventErrors.Gone());

        if (updated.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<EventResponse>(await EditConflictAsync(userIdentifier, identifier, request.MaxParticipants, ctoken));

        if (!updated.IsSuccess)
            return Result.Fail<EventResponse>(new Message(500, "An error occurred while updating the event."));

        return await GetAsync(userIdentifier, identifier, ctoken);
    }

    private static readonly TimeSpan SameTimeTolerance = TimeSpan.FromMinutes(1);

    // Within a minute counts as unchanged: a form that rebuilds a time from a picker drops the seconds. keep-comment: why not exact equality
    private static bool Moved(DateTime? sent, DateTime? stored)
    {
        if (sent is null || stored is null)
            return sent != stored;

        return (sent.Value - stored.Value).Duration() >= SameTimeTolerance;
    }

    private static DateTime PastAfterOf(DateTime startsAt, DateTime? endsAt)
    {
        return endsAt ?? startsAt.AddDays(1);
    }

    // Its trail was deleted (SetNull) and nothing else places it, so only the stored Location is left. keep-comment: lets such an event be edited without picking a new place
    private static bool HasNoPlaceLeft(EventDetail detail)
    {
        return detail.Event.TrailId is null && detail.Event.MeetingPoint is null && !detail.RouteLengthMetres.HasValue;
    }

    private static Message? CapacityRefusal(Event current, int? maxParticipants)
    {
        return maxParticipants.HasValue && maxParticipants.Value < current.ParticipantCount
            ? new Message(400, $"{current.ParticipantCount} people have already joined.")
            : null;
    }

    // The event changed between the check and the save; reloading names the reason. keep-comment: mirrors NoSpotTakenAsync for join
    private async Task<Message> EditConflictAsync(string userIdentifier, string identifier, int? maxParticipants, CancellationToken ctoken)
    {
        var reloaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (reloaded.Message is not null || reloaded.Value is null)
            return reloaded.Message ?? EventErrors.Gone();

        return reloaded.Value.Membership.EditRefusal()
            ?? CapacityRefusal(reloaded.Value.Detail.Event, maxParticipants)
            ?? new Message(409, "The event changed while you were editing it.");
    }

    public async Task<Result> CancelAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        var refusal = loaded.Value.Membership.CancelRefusal();

        if (refusal is not null)
            return Result.Fail(refusal);

        var cancelled = await _eventRepository.CancelAsync(identifier, loaded.Value.ViewerId, DateTime.UtcNow, ctoken);

        if (cancelled.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(EventErrors.Gone());

        if (cancelled.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(EventErrors.Cancelled());

        if (!cancelled.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while cancelling the event."));

        if (cancelled.Value.NotifyUserIds.Count > 0)
            _pushQueue.Enqueue(EventPushes.Cancelled(identifier, cancelled.Value.Title, cancelled.Value.StartsAt, cancelled.Value.NotifyUserIds, loaded.Value.ViewerId));

        return Result.Ok();
    }

    public async Task<Result> DeleteAsync(string userIdentifier, string identifier, CancellationToken ctoken)
    {
        var loaded = await _loader.LoadAsync(userIdentifier, identifier, ctoken);

        if (loaded.Message is not null || loaded.Value is null)
            return Result.Fail(loaded.Message ?? EventErrors.Gone());

        if (!loaded.Value.Membership.CanDelete())
            return Result.Fail(EventErrors.NotAllowed());

        var deleted = await _eventRepository.DeleteAsync(identifier, loaded.Value.ViewerId, DateTime.UtcNow, ctoken);

        if (deleted.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(EventErrors.Gone());

        if (!deleted.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the event."));

        if (deleted.Value.NotifyUserIds.Count > 0)
            _pushQueue.Enqueue(EventPushes.Cancelled(identifier, deleted.Value.Title, deleted.Value.StartsAt, deleted.Value.NotifyUserIds, loaded.Value.ViewerId));

        if (deleted.Value.ImageUrl is not null)
            await DeleteImageFileAsync(deleted.Value.ImageUrl, identifier);

        return Result.Ok();
    }

    // NewRoute null and KeepRoute false means the event ends up without a route. keep-comment: the three route outcomes
    private sealed record Place(int? TrailId, Point? MeetingPoint, Point Location, EventRoute? NewRoute, bool KeepRoute);

    // The start of the route an edit keeps, or null when there is none to keep or a meeting point makes it moot. keep-comment: only then is the path read
    private async Task<Result<Point?>> StoredRouteStartAsync(EventDetail detail, UpdateEventRequest request, CancellationToken ctoken)
    {
        var keeps = detail.RouteLengthMetres.HasValue
            && !request.MeetingPointLatitude.HasValue
            && !request.RemoveRoute
            && string.IsNullOrWhiteSpace(request.TrailIdentifier)
            && string.IsNullOrWhiteSpace(request.HikeIdentifier);

        if (!keeps)
            return Result.Ok<Point?>(null);

        var route = await _eventRepository.GetRoutePathAsync(detail.Event.Id, ctoken);

        if (!route.IsSuccess)
            return Result.Fail<Point?>(new Message(500, "An error occurred while fetching the route."));

        return Result.Ok<Point?>(route.Value.StartPoint);
    }

    // A hike is copied only from the editor's own hikes, so a CoHost can never pick the organizer's. keep-comment: the own-hike rule
    private async Task<Result<Place>> ResolvePlaceAsync(EventRequest request, int editorId, int? currentTrailId, Point? keptLocation, bool removeRoute, CancellationToken ctoken)
    {
        var meetingPoint = GeoPointFactory.FromLonLat(request.MeetingPointLongitude, request.MeetingPointLatitude);
        int? trailId = null;
        Point? trailStart = null;
        EventRoute? newRoute = null;

        if (!string.IsNullOrWhiteSpace(request.TrailIdentifier))
        {
            var anchor = await _eventRepository.GetTrailAnchorAsync(request.TrailIdentifier, currentTrailId, ctoken);

            if (anchor.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<Place>(new Message(400, "TrailIdentifier must name a published trail."));

            if (!anchor.IsSuccess)
                return Result.Fail<Place>(new Message(500, "An error occurred while fetching the trail."));

            trailId = anchor.Value.TrailId;
            trailStart = anchor.Value.Start;
        }
        else if (!string.IsNullOrWhiteSpace(request.HikeIdentifier))
        {
            var hikePath = await _eventRepository.GetOwnHikePathAsync(request.HikeIdentifier, editorId, ctoken);

            if (hikePath.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<Place>(new Message(400, "HikeIdentifier must name one of your own hikes."));

            if (!hikePath.IsSuccess)
                return Result.Fail<Place>(new Message(500, "An error occurred while fetching the hike."));

            var copy = EventRouteCopy.FromHike(hikePath.Value, request.RouteTrimStartIndex, request.RouteTrimEndIndex);

            if (copy.Message is not null || copy.Value is null)
                return Result.Fail<Place>(copy.Message ?? new Message(500, "The route could not be copied."));

            newRoute = copy.Value;
        }

        var keepRoute = trailId is null && newRoute is null && !removeRoute;
        var location = meetingPoint ?? trailStart ?? newRoute?.Path.StartPoint ?? keptLocation;

        if (location is null)
            return Result.Fail<Place>(new Message(400, "An event needs a meeting point, a trail or a hike."));

        return Result.Ok(new Place(trailId, meetingPoint, location, newRoute, keepRoute));
    }

    private static void Apply(Event e, EventRequest request, Place place)
    {
        e.TrailId = place.TrailId;
        e.MeetingPoint = place.MeetingPoint;
        e.Location = place.Location;

        if (place.NewRoute is not null && e.Route is not null)
        {
            e.Route.Path = place.NewRoute.Path;
            e.Route.LengthMetres = place.NewRoute.LengthMetres;
        }
        else if (place.NewRoute is not null || !place.KeepRoute)
        {
            e.Route = place.NewRoute;
        }

        e.LocationName = Blank(request.LocationName);
        e.MeetingPointName = Blank(request.MeetingPointName);
        e.StartsAt = UtcDates.ToUtc(request.StartsAt);
        e.EndsAt = UtcDates.ToUtc(request.EndsAt);
        e.PastAfter = PastAfterOf(e.StartsAt, e.EndsAt);
        e.RegistrationDeadline = UtcDates.ToUtc(request.RegistrationDeadline);
        e.MaxParticipants = request.MaxParticipants;
    }

    private static string? Blank(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private EventPageResponse Page(IReadOnlyList<EventCard> cards, int limit, Coordinate? origin)
    {
        var page = cards.Take(limit).ToList();
        var projection = origin is null ? null : LocalMetricProjection.CentredOn(origin);

        return new EventPageResponse
        {
            Items = page.Select(c => _factory.CreateSummary(c, DistanceMeters(projection, c))).ToList(),
            NextCursor = cards.Count > limit
                ? EventCursor.Encode(new EventPageKey(page[^1].StartsAt, page[^1].Id))
                : null,
        };
    }

    private static double? DistanceMeters(LocalMetricProjection? projection, EventCard card)
    {
        if (projection is null)
            return null;

        var projected = projection.Project(new Coordinate(card.Longitude, card.Latitude));
        return Math.Round(Math.Sqrt((projected.X * projected.X) + (projected.Y * projected.Y)));
    }

    private async Task DeleteImageFileAsync(string url, string eventIdentifier)
    {
        try
        {
            var result = await _webDavService.DeleteFileAsync(url);

            if (result.IsFailure)
                _logger.LogError("EventService: DeleteAsync -> WebDAV refused to delete image {Url} of event {EventIdentifier}.", url, eventIdentifier);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "EventService: DeleteAsync -> Failed to delete image {Url} of event {EventIdentifier}.", url, eventIdentifier);
        }
    }
}
