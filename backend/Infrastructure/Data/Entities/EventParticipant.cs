// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class EventParticipant
{
    public int EventId { get; set; }
    public int UserId { get; set; }
    public EventParticipantRole Role { get; set; } = EventParticipantRole.Participant;
    public EventParticipantStatus Status { get; set; } = EventParticipantStatus.Joined;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool MutePosts { get; set; }
    public DateTime? LastPostPushAt { get; set; }

    // Written only by PUT /posts/read, so prefetching the board never marks posts read. keep-comment: the GET must stay read-only
    public DateTime? LastReadPostAt { get; set; }

    public Event? Event { get; set; }
    public User? User { get; set; }
}
