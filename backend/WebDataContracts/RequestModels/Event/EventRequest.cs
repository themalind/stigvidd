// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventRequest
{
    public required string Title { get; set; }
    public required string Description { get; set; }
    public string? TrailIdentifier { get; set; }
    public string? HikeIdentifier { get; set; }
    public int? RouteTrimStartIndex { get; set; }
    public int? RouteTrimEndIndex { get; set; }
    public string? LocationName { get; set; }
    public decimal? MeetingPointLongitude { get; set; }
    public decimal? MeetingPointLatitude { get; set; }
    public string? MeetingPointName { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public DateTime? RegistrationDeadline { get; set; }
    public int? MaxParticipants { get; set; }
    public bool AllowParticipantInvites { get; set; }
}
