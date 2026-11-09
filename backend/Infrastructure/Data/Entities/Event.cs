// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

public class Event : BaseEntity
{
    // Set by the app, so a retried save finds the row instead of adding another.
    public Guid? ClientRequestId { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }

    public int? TrailId { get; set; }
    public string? LocationName { get; set; }

    public Point? MeetingPoint { get; set; }
    public string? MeetingPointName { get; set; }

    // MeetingPoint, else the linked trail's start, else the route's start; set by the service on create and edit. keep-comment: denormalised, nothing in the model keeps it in step
    public required Point Location { get; set; }

    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }

    // coalesce(EndsAt, StartsAt + 1 day), set by the service; "past" means PastAfter <= now everywhere. keep-comment: the single definition of past
    public DateTime PastAfter { get; set; }

    public DateTime? RegistrationDeadline { get; set; }

    public int? MaxParticipants { get; set; }

    // Joined rows only, the organizer included. keep-comment: maintained by the conditional increment and RecountAsync, never by hand
    public int ParticipantCount { get; set; }

    public EventVisibility Visibility { get; set; }
    public bool AllowParticipantInvites { get; set; }
    public EventStatus Status { get; set; }
    public DateTime? CancelledAt { get; set; }

    // No query filter: a reported event stays visible to its participants and is only kept out of the feed. keep-comment: filtering it would hide it from them too
    public ModerationState ModerationState { get; set; }

    public Trail? Trail { get; set; }
    public List<EventParticipant> Participants { get; set; } = [];
    public List<EventInvitation> Invitations { get; set; } = [];
    public List<EventPost> Posts { get; set; } = [];
    public EventImage? Image { get; set; }
    // Its own table so the path is read for the detail only, not on every action. keep-comment: why not a column
    public EventRoute? Route { get; set; }
}
