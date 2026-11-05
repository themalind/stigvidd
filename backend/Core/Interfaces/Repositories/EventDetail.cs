// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories;

public record EventDetail(
    Event Event,
    string? TrailIdentifier,
    string? TrailName,
    decimal? TrailLengthKm,
    int? RouteLengthMetres,
    string? ImageUrl,
    ModerationState? ImageModerationState,
    string? ImageIdentifier,
    int? OrganizerUserId,
    string? OrganizerNickName,
    int InterestedCount,
    EventParticipantRole? MyRole,
    EventParticipantStatus? MyStatus,
    bool HasPendingInvite);
