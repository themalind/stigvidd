// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventSummaryResponse
{
    public required string Identifier { get; set; }
    public required string Title { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? PlaceName { get; set; }
    public string? RouteKind { get; set; }
    public int? RouteLengthMeters { get; set; }
    public required string Visibility { get; set; }
    public required string Status { get; set; }
    public int ParticipantCount { get; set; }
    public int? MaxParticipants { get; set; }
    public string? ImageUrl { get; set; }
    public string? OrganizerNickName { get; set; }
    public double? DistanceMeters { get; set; }
    public string? MyRole { get; set; }
    public string? MyStatus { get; set; }
    public int UnreadPostCount { get; set; }
}
