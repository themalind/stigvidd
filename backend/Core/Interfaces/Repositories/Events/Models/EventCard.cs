// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Events.Models;

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
