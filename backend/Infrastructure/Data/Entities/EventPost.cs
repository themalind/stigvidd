// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class EventPost : BaseEntity
{
    // Set by the app, so a retried save finds the row instead of adding another.
    public Guid? ClientRequestId { get; set; }
    public int EventId { get; set; }
    public int? UserId { get; set; }
    public required string Body { get; set; }
    public bool IsPinned { get; set; }
    public DateTime? EditedAt { get; set; }
    public ModerationState ModerationState { get; set; }

    public Event? Event { get; set; }
    public User? User { get; set; }
}
