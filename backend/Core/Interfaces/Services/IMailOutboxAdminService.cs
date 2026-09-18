// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.MailOutbox;
using WebDataContracts.ResponseModels.MailOutbox;

namespace Core.Interfaces.Services;

/// <summary>
/// Reading and managing the mail outbox from the admin web.
/// </summary>
/// <remarks>
/// Deliberately NOT methods on IMailOutboxService. That interface is "the way application code
/// sends mail" and is injected into registration and password reset; hanging a table-purging
/// operation off it would put a destructive admin action on the interface account creation
/// depends on. Same split as IMailTemplateAdminService beside IMailTemplateRepository.
/// </remarks>
public interface IMailOutboxAdminService
{
    Task<Result<PagedResult<OutboxEmailSummaryResponse>>> GetPagedAsync(
        string? status, string? templateKey, string? recipient, int page, int pageSize, CancellationToken ctoken);

    Task<Result<OutboxEmailDetailResponse>> GetDetailAsync(string identifier, CancellationToken ctoken);

    Task<Result<MailOutboxCountsResponse>> GetCountsAsync(CancellationToken ctoken);

    /// <summary>
    /// Puts a Failed or Cancelled mail back in the queue, due now.
    /// </summary>
    Task<Result<OutboxEmailDetailResponse>> RetryAsync(string identifier, CancellationToken ctoken);

    /// <summary>Stops a Pending mail before it is ever claimed.</summary>
    Task<Result<OutboxEmailDetailResponse>> CancelAsync(string identifier, CancellationToken ctoken);

    /// <summary>Deletes sent mail older than the requested cutoff.</summary>
    Task<Result<MailOutboxPurgeResponse>> PurgeAsync(PurgeMailOutboxRequest request, CancellationToken ctoken);
}
