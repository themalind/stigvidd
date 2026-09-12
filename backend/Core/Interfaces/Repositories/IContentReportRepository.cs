// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories;

// What a report needs to know about the thing being reported, read past the moderation
// filter so already hidden content can still be reported.
public record ReportableContent(
    int ContentId,
    string ContentIdentifier,
    int? AuthorUserId,
    string? AuthorNickName,
    int? TrailId,
    string? TrailIdentifier,
    string? Snapshot,
    ModerationState ModerationState);

// One row in the admin queue. The nicknames are looked up on the id where the user is still
// there and fall back to the snapshot, because the snapshot goes stale on a rename and is
// nulled outright when the author deletes their account.
public record ContentReportSummary(
    string Identifier,
    ReportedContentType ContentType,
    string ContentIdentifier,
    string? TrailIdentifier,
    ReportReason Reason,
    string? ReporterNote,
    ReportStatus Status,
    ReportHideOutcome HideOutcome,
    string? ReporterNickName,
    string? AuthorNickName,
    string? ContentSnapshot,
    bool ContentStillExists,
    string? DecidedBy,
    DateTime? DecidedAt,
    string? DecisionNote,
    DateTime CreatedAt);

// A reporter's own record, which is what the withholding rule reads and what the queue shows
// next to their name.
public record ReporterRecord(int Total, int Pending, int Dismissed, int Upheld);

// One row in the Reporters tab. Who keeps pressing the button, and how often they were
// right about it.
public record ReporterStatistic(
    int ReporterUserId,
    string? NickName,
    int Total,
    int Pending,
    int Dismissed,
    int Upheld,
    DateTime LastReportedAt);

// One row in the Authors tab. Strikes are counted on distinct content, so a review three
// people reported is one strike; this is the list an account removal is decided from.
public record AuthorStatistic(
    int AuthorUserId,
    string? NickName,
    int Strikes);

// What applying a decision actually did. The image URLs come back so the caller can clear
// them off WebDAV after the row is gone.
public record DecisionOutcome(
    ReportStatus AppliedStatus,
    IReadOnlyCollection<string> DeletedImageUrls,
    int ReportsSettled);

public interface IContentReportRepository
{
    Task<RepositoryResult<ReportableContent>> GetReportableContentAsync(
        ReportedContentType contentType, string contentIdentifier, CancellationToken ctoken);

    Task<RepositoryResult<int>> CountReportsByReporterSinceAsync(
        int reporterUserId, DateTime since, CancellationToken ctoken);

    Task<RepositoryResult<int>> CountDismissedReportsByReporterAsync(
        int reporterUserId, CancellationToken ctoken);

    Task<RepositoryResult<bool>> HasReporterAlreadyReportedAsync(
        int reporterUserId, ReportedContentType contentType, int contentId, CancellationToken ctoken);

    Task<RepositoryResult<ContentReport>> AddReportAsync(
        ContentReport report, bool hideContent, CancellationToken ctoken);

    // Account deletion. Two different jobs in one step: what the user reported stays
    // Pending because it still needs a decision, while reports ABOUT them are settled and
    // their snapshot cleared.
    Task<RepositoryResult> HandleUserDeletionAsync(int userId, CancellationToken ctoken);

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
