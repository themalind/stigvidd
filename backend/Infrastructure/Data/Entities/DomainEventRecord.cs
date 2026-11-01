// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// This table is both the work queue and the history; the in-memory signal only hints. keep-comment: why the signal may be lost safely
public class DomainEventRecord : BaseEntity
{
    public const int MaxKeyLength = 100;

    // The [DomainEventName] value, never a CLR type name, so renaming a class strands no rows. keep-comment: stable key
    public required string EventType { get; set; }

    // Internal identifiers only, never a name or e-mail: the row outlives the account it mentions. keep-comment: GDPR constraint
    public required string Payload { get; set; }

    public string? EntityKey { get; set; }

    public string? TraceId { get; set; }

    public DomainEventStatus Status { get; set; }

    public int Attempts { get; set; }

    public DateTime NextAttemptAt { get; set; }

    public string? LastError { get; set; }

    public string? CompletedHandlers { get; set; }

    // Retention dates rows by this, never LastUpdatedAt, which every claim and retry rewrites. keep-comment: see a-retention-clock-must-not-be-a-column-everything-writes
    public DateTime? SettledAt { get; set; }
}
