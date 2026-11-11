// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// NotifyUserIds leaves out invitees who blocked the inviter: they get no row and no push. keep-comment: the silent skip a caller must not undo
public sealed record InviteOutcome(string InviterNickName, IReadOnlyList<int> NotifyUserIds);
