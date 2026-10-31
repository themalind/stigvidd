// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Core.Interfaces.Repositories;

public record TrailAnchor(int TrailId, Point Start);

public record EventPageKey(DateTime StartsAt, int Id);

public record EventArea(double Longitude, double Latitude, double RadiusMeters);

public record EventFeedFilter(
    int ViewerId,
    int[] HiddenUserIds,
    DateTime Now,
    string? TrailIdentifier,
    string? OrganizerIdentifier,
    EventArea? Area,
    EventPageKey? After,
    int Limit);

public record EventMineFilter(int ViewerId, int[] HiddenUserIds, DateTime Now, bool Past, EventPageKey? After, int Limit);

public record EventCard(
    int Id,
    string Identifier,
    string Title,
    DateTime StartsAt,
    DateTime? EndsAt,
    string? LocationName,
    string? MeetingPointName,
    string? TrailName,
    decimal? TrailLengthKm,
    int? RouteLengthMetres,
    EventVisibility Visibility,
    EventStatus Status,
    int ParticipantCount,
    int? MaxParticipants,
    string? ImageUrl,
    ModerationState? ImageModerationState,
    string? OrganizerNickName,
    double Longitude,
    double Latitude,
    EventParticipantRole? MyRole,
    EventParticipantStatus? MyStatus,
    int UnreadPostCount);

public record EventDetail(
    Event Event,
    string? TrailIdentifier,
    string? TrailName,
    decimal? TrailLengthKm,
    int? RouteLengthMetres,
    string? ImageUrl,
    ModerationState? ImageModerationState,
    int? OrganizerUserId,
    string? OrganizerNickName,
    int InterestedCount,
    EventParticipantRole? MyRole,
    EventParticipantStatus? MyStatus,
    bool HasPendingInvite);

public record CancelledEvent(string Title, DateTime StartsAt, IReadOnlyCollection<int> NotifyUserIds);

// NotifyUserIds is empty unless the event was still published and upcoming. keep-comment: nobody needs telling about a past or already-cancelled event
public record DeletedEvent(string Identifier, string Title, DateTime StartsAt, string? ImageUrl, IReadOnlyCollection<int> NotifyUserIds);

public interface IEventRepository
{
    // A published trail, or the event's current one even if it has since been unpublished. keep-comment: an edit must not have to drop its trail
    Task<RepositoryResult<TrailAnchor>> GetTrailAnchorAsync(string trailIdentifier, int? currentTrailId, CancellationToken ctoken);
    // NotFound for a hike that is missing or someone else's alike. keep-comment: the answer must not confirm that a hike exists
    Task<RepositoryResult<LineString>> GetOwnHikePathAsync(string hikeIdentifier, int userId, CancellationToken ctoken);
    Task<RepositoryResult<LineString>> GetRoutePathAsync(int eventId, CancellationToken ctoken);
    Task<RepositoryResult<int>> CountUpcomingAsOrganizerAsync(int userId, DateTime now, CancellationToken ctoken);
    // Read from the action log, so deleting or handing over an event does not lower it. keep-comment: why not count Events
    Task<RepositoryResult<int>> CountCreatedSinceAsync(int userId, DateTime since, CancellationToken ctoken);
    // Records EventCreated in the same save and prunes the creator's log rows older than createdLogWindow. keep-comment: the window belongs to EventLimits, not the repository
    Task<RepositoryResult<string>> CreateAsync(Event newEvent, int organizerUserId, TimeSpan createdLogWindow, CancellationToken ctoken);
    Task<RepositoryResult<EventDetail>> GetDetailAsync(string identifier, int viewerId, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyList<EventCard>>> GetFeedAsync(EventFeedFilter query, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyList<EventCard>>> GetMineAsync(EventMineFilter query, CancellationToken ctoken);
    // Conflict, with nothing saved, when the event is cancelled or apply leaves MaxParticipants below ParticipantCount. keep-comment: guards the service's check cannot hold
    Task<RepositoryResult> UpdateAsync(string identifier, Action<Event> apply, CancellationToken ctoken);
    Task<RepositoryResult<CancelledEvent>> CancelAsync(string identifier, int cancelledByUserId, DateTime now, CancellationToken ctoken);
    Task<RepositoryResult<DeletedEvent>> DeleteAsync(string identifier, int deletedByUserId, DateTime now, CancellationToken ctoken);
}
