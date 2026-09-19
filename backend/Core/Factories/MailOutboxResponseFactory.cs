// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.ResponseModels.MailOutbox;

namespace Core.Factories;

/// <summary>
/// Outbox rows to their wire shape. The only place that reads a mail body — and it does so
/// only in CreateBody, which serves the one route that logs the read.
/// </summary>
public class MailOutboxResponseFactory
{
    public OutboxEmailSummaryResponse Create(OutboxEmailSummary summary) =>
        OutboxEmailSummaryResponse.Create(
            summary.Identifier,
            summary.ToAddress,
            summary.ToName,
            summary.Subject,
            summary.TemplateKey,
            summary.Status.ToString(),
            summary.Attempts,
            summary.NextAttemptAt,
            summary.SentAt,
            summary.LastError,
            summary.SettledAt,
            summary.RedactedAt,
            summary.CreatedAt,
            summary.LastUpdatedAt);

    public IReadOnlyCollection<OutboxEmailSummaryResponse> Create(
        IReadOnlyCollection<OutboxEmailSummary> summaries) =>
        summaries.Select(Create).ToList();

    /// <summary>The summary half of an entity, without touching the bodies.</summary>
    public OutboxEmailSummaryResponse CreateSummary(OutboxEmail email) =>
        OutboxEmailSummaryResponse.Create(
            email.Identifier,
            email.ToAddress,
            email.ToName,
            email.Subject,
            email.TemplateKey,
            email.Status.ToString(),
            email.Attempts,
            email.NextAttemptAt,
            email.SentAt,
            email.LastError,
            email.SettledAt,
            email.RedactedAt,
            email.CreatedAt,
            email.LastUpdatedAt);

    public OutboxEmailDetailResponse Create(OutboxEmail email) =>
        OutboxEmailDetailResponse.Create(CreateSummary(email));

    /// <summary>
    /// The bodies, on their own. Separate from Create so that reading them is a distinct call
    /// a controller has to choose to make — and can log.
    /// </summary>
    public OutboxEmailBodyResponse CreateBody(OutboxEmail email) =>
        OutboxEmailBodyResponse.Create(email.Identifier, email.BodyHtml, email.BodyText);

    public MailOutboxCountsResponse Create(IReadOnlyDictionary<OutboxEmailStatus, int> counts)
    {
        // A status with no rows still renders a zero rather than nothing.
        int Of(OutboxEmailStatus status) => counts.TryGetValue(status, out var count) ? count : 0;

        return MailOutboxCountsResponse.Create(
            Of(OutboxEmailStatus.Pending),
            Of(OutboxEmailStatus.Sending),
            Of(OutboxEmailStatus.Sent),
            Of(OutboxEmailStatus.Failed),
            Of(OutboxEmailStatus.Cancelled));
    }
}
