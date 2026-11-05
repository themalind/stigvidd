// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Projections.MailOutbox;

// keep-comment: no BodyHtml/BodyText on purpose, so a page of the outbox never loads megabytes of rendered mail
public record OutboxEmailSummary(
    string Identifier,
    string ToAddress,
    string? ToName,
    string Subject,
    string? TemplateKey,
    OutboxEmailStatus Status,
    int Attempts,
    DateTime NextAttemptAt,
    DateTime? SentAt,
    string? LastError,
    DateTime? SettledAt,
    DateTime? RedactedAt,
    DateTime CreatedAt,
    DateTime LastUpdatedAt);
