// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Reporting;

public interface IContentReportRepository
{
    Task<RepositoryResult<ReportableContent>> GetReportableContentAsync(
        ReportedContentType contentType, string contentIdentifier, int reporterUserId, CancellationToken ctoken);

    Task<RepositoryResult<int>> CountReportsByReporterSinceAsync(
        int reporterUserId, DateTime since, CancellationToken ctoken);

    Task<RepositoryResult<int>> CountDismissedReportsByReporterAsync(
        int reporterUserId, CancellationToken ctoken);

    Task<RepositoryResult<bool>> HasReporterAlreadyReportedAsync(
        int reporterUserId, ReportedContentType contentType, int contentId, CancellationToken ctoken);

    Task<RepositoryResult<ContentReport>> AddReportAsync(
        ContentReport report, bool hideContent, CancellationToken ctoken);

    // --- The admin queue ---

    Task<RepositoryResult<PagedResult<ContentReportSummary>>> GetPagedAsync(
        ReportStatus? status,
        ReportedContentType? contentType,
        ReportHideOutcome? hideOutcome,
        int page,
        int pageSize,
        CancellationToken ctoken);

    Task<RepositoryResult<ContentReportSummary>> GetSummaryByIdentifierAsync(
        string identifier, CancellationToken ctoken);

    // The raw row, for deciding on. Separate from the summary because a decision reads
    // fields the queue never shows.
    Task<RepositoryResult<ContentReport>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyDictionary<ReportStatus, int>>> GetCountsByStatusAsync(CancellationToken ctoken);

    // Strikes, counted on DISTINCT content rather than on rows. One decision settles every
    // pending report on the same content, so counting rows would turn a review three people
    // reported into three strikes.
    Task<RepositoryResult<int>> CountUpheldContentByAuthorAsync(int authorUserId, CancellationToken ctoken);

    Task<RepositoryResult<ReporterRecord>> GetReporterRecordAsync(int reporterUserId, CancellationToken ctoken);

    // --- The statistics tabs ---

    // Reports whose reporter deleted their account have ReporterUserId nulled, so they are
    // left out: nobody is behind them any more and the tab exists to name an account.
    Task<RepositoryResult<PagedResult<ReporterStatistic>>> GetReporterStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken);

    Task<RepositoryResult<PagedResult<AuthorStatistic>>> GetAuthorStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken);

    // One save: the content is deleted or restored and every pending report on it is settled
    // together, so the queue can never hold a stale row for content that has been decided.
    Task<RepositoryResult<DecisionOutcome>> ApplyDecisionAsync(
        ReportedContentType contentType,
        int contentId,
        ReportStatus decision,
        string decidedBy,
        string? decisionNote,
        CancellationToken ctoken);
}
