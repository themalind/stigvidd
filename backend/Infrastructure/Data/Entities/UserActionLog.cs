// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// One row per rate-limited action, kept apart from what the action made so deleting that does not lower the count. keep-comment: why caps are not counted on the content rows
public class UserActionLog
{
    public long Id { get; set; }
    public int UserId { get; set; }
    public UserAction Action { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User? User { get; set; }
}
