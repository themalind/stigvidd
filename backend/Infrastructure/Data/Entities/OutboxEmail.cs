// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// One mail waiting to go out, or the record of one that did. This table IS the queue: the
// in-memory channel only says "look at row N sooner rather than later", so a lost signal
// costs latency and never a mail.
//
// The body is stored already rendered. Rendering happens at enqueue time, where a missing
// placeholder can still be reported to a caller, and it means editing a template never
// rewrites mail that was queued before the edit.
public class OutboxEmail : BaseEntity
{
    public required string ToAddress { get; set; }
    public string? ToName { get; set; }

    public required string Subject { get; set; }
    public required string BodyHtml { get; set; }
    public required string BodyText { get; set; }

    // Which template produced this, for diagnosis only — never read back to re-render.
    public string? TemplateKey { get; set; }

    public OutboxEmailStatus Status { get; set; }

    public int Attempts { get; set; }

    // Not before this instant. Set to now on enqueue, pushed out by the backoff on failure.
    public DateTime NextAttemptAt { get; set; }

    public DateTime? SentAt { get; set; }

    // The last transport error, kept on a Failed row so there is something to diagnose from.
    public string? LastError { get; set; }
}
