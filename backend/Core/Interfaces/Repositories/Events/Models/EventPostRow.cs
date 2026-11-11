// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

public record EventPostRow(
    int Id,
    string Identifier,
    int? UserId,
    string? UserIdentifier,
    string? NickName,
    string Body,
    bool IsPinned,
    DateTime CreatedAt,
    DateTime? EditedAt);
