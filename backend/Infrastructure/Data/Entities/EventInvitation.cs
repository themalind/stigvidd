// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// Accepted rows are kept: the per-inviter daily cap counts them. keep-comment: why accepting does not delete the row
public class EventInvitation
{
    public int EventId { get; set; }
    public int InvitedUserId { get; set; }
    public int? InvitedByUserId { get; set; }
    public EventInvitationStatus Status { get; set; } = EventInvitationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Event? Event { get; set; }
    public User? InvitedUser { get; set; }
    public User? InvitedBy { get; set; }
}
