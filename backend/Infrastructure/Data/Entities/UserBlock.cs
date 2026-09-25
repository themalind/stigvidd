// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class UserBlock
{
    public int BlockerUserId { get; set; }
    public int BlockedUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User? Blocker { get; set; }
    public User? Blocked { get; set; }
}
