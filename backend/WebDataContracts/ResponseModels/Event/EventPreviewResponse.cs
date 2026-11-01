// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

// Served without sign-in, so it names no person. keep-comment: where someone will be on a given day is theirs to share
public class EventPreviewResponse
{
    public required string Identifier { get; set; }
    public required string Title { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public string? PlaceName { get; set; }
    public int? RouteLengthMeters { get; set; }
    public int ParticipantCount { get; set; }
    public int? MaxParticipants { get; set; }
    public string? ImageUrl { get; set; }
}
