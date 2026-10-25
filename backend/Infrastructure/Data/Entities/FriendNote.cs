// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: private to the owner; never sent to the friend it is about
public class FriendNote
{
    public const int MaxLength = 60;

    public int OwnerUserId { get; set; }
    public int FriendUserId { get; set; }
    public required string Text { get; set; }
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
    public User? Owner { get; set; }
    public User? Friend { get; set; }
}
