// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventResponse
{
    public required string Identifier { get; set; }
    public required string Title { get; set; }
    public required string Description { get; set; }
    public string? TrailIdentifier { get; set; }
    public string? TrailName { get; set; }
    public EventRouteResponse? Route { get; set; }
    public string? LocationName { get; set; }
    public decimal? MeetingPointLongitude { get; set; }
    public decimal? MeetingPointLatitude { get; set; }
    public string? MeetingPointName { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public DateTime? RegistrationDeadline { get; set; }
    public int? MaxParticipants { get; set; }
    public int ParticipantCount { get; set; }
    public int InterestedCount { get; set; }
    public required string Visibility { get; set; }
    public bool AllowParticipantInvites { get; set; }
    public required string Status { get; set; }
    public DateTime? CancelledAt { get; set; }
    public bool IsPast { get; set; }
    public string? ImageUrl { get; set; }
    // For reporting the cover; null whenever ImageUrl is. keep-comment: the report endpoint takes the image's own identifier
    public string? ImageIdentifier { get; set; }
    public string? OrganizerNickName { get; set; }

    public string? MyRole { get; set; }
    public string? MyStatus { get; set; }
    public bool HasPendingInvite { get; set; }
    public int UnreadPostCount { get; set; }
    public required EventPermissionsResponse Permissions { get; set; }
}
