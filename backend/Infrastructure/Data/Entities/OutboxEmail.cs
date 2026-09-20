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

    // When this row reached Failed or Cancelled, exactly as SentAt records reaching Sent.
    //
    // The retention sweep dates settled rows by THIS and never by LastUpdatedAt, which seven
    // methods here already write. Redaction would be an eighth, so a sweep keyed on
    // LastUpdatedAt would restart a row's own deletion clock every time it cleared its body,
    // and a redacted row would then never be deleted at all. LastUpdatedAt answers "when was
    // this last touched"; this answers "when did it stop moving".
    public DateTime? SettledAt { get; set; }

    // When the bodies were cleared. A body is only needed while the mail can still be sent, and
    // for verify-email and reset-password it holds a live token URL — so it does not outlive
    // that need. This, not the emptiness of the two strings, is the signal: it is what the
    // admin UI branches on to explain itself, and what RequeueAsync checks before it will put
    // a row back on the queue.
    public DateTime? RedactedAt { get; set; }
}
