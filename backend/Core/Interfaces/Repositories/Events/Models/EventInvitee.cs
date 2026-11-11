// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

public sealed record EventInvitee(int UserId, string UserIdentifier, string NickName, int? InvitedByUserId, string? InvitedByNickName, DateTime InvitedAt);
