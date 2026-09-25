// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class UserBan
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateTime BannedAt { get; set; } = DateTime.UtcNow;
    public required string BannedBy { get; set; }
    public string? Reason { get; set; }
    public DateTime? LiftedAt { get; set; }
    public string? LiftedBy { get; set; }
}
