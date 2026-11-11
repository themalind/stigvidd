// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Events.Models;

public record EventParticipantRow(int UserId, string UserIdentifier, string NickName, EventParticipantRole Role, EventParticipantStatus Status, DateTime JoinedAt);
