// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailOutbox;

/// <summary>
/// One row of the outbox list. Deliberately carries no mail body — see OutboxEmailDetailResponse.
/// </summary>
public class OutboxEmailSummaryResponse
{
    public required string Identifier { get; set; }
    public required string ToAddress { get; set; }
    public string? ToName { get; set; }
    public required string Subject { get; set; }

    // Which template produced this. Null for a row whose template was not recorded.
    public string? TemplateKey { get; set; }

    public required string Status { get; set; }
    public int Attempts { get; set; }
    public DateTime NextAttemptAt { get; set; }
    public DateTime? SentAt { get; set; }

    // Kept on a retried row too: it is the only record of why the last attempt failed, and the
    // retry has not produced a new one yet.
    public string? LastError { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }

    public static OutboxEmailSummaryResponse Create(
        string identifier,
        string toAddress,
        string? toName,
        string subject,
        string? templateKey,
        string status,
        int attempts,
        DateTime nextAttemptAt,
        DateTime? sentAt,
        string? lastError,
        DateTime createdAt,
        DateTime lastUpdatedAt) => new()
        {
            Identifier = identifier,
            ToAddress = toAddress,
            ToName = toName,
            Subject = subject,
            TemplateKey = templateKey,
            Status = status,
            Attempts = attempts,
            NextAttemptAt = nextAttemptAt,
            SentAt = sentAt,
            LastError = lastError,
            CreatedAt = createdAt,
            LastUpdatedAt = lastUpdatedAt,
        };
}
