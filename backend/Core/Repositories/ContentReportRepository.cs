// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Repositories.Reporting;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class ContentReportRepository : IContentReportRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ReportableContentHandlers _handlers;
    private readonly ILogger<ContentReportRepository> _logger;

    public ContentReportRepository(IDbContextFactory<StigViddDbContext> context, ReportableContentHandlers handlers, ILogger<ContentReportRepository> logger)
    {
        _context = context;
        _handlers = handlers;
        _logger = logger;
    }

    // Reads past the moderation filter on purpose: content that is already hidden must still
    // be reportable, or the second reporter gets a 404 on something they saw a moment ago.
    public async Task<RepositoryResult<ReportableContent>> GetReportableContentAsync(
        ReportedContentType contentType, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        try
        {
            var handler = _handlers.For(contentType);

            if (handler is null)
                return RepositoryResult<ReportableContent>.NotFound();

            using var context = await _context.CreateDbContextAsync(ctoken);

            var content = await handler.FindAsync(context, contentIdentifier, reporterUserId, ctoken);

            return content is null
                ? RepositoryResult<ReportableContent>.NotFound()
                : RepositoryResult<ReportableContent>.Success(content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetReportableContentAsync -> Something went wrong when fetching {contentType} with identifier {contentIdentifier}.", contentType, contentIdentifier);
            return RepositoryResult<ReportableContent>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CountReportsByReporterSinceAsync(
        int reporterUserId, DateTime since, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var count = await context.ContentReports
                .CountAsync(r => r.ReporterUserId == reporterUserId && r.CreatedAt > since, ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: CountReportsByReporterSinceAsync -> Something went wrong when counting reports for user {reporterUserId}.", reporterUserId);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<int>> CountDismissedReportsByReporterAsync(
        int reporterUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var count = await context.ContentReports
                .CountAsync(r => r.ReporterUserId == reporterUserId && r.Status == ReportStatus.Dismissed, ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: CountDismissedReportsByReporterAsync -> Something went wrong when counting dismissed reports for user {reporterUserId}.", reporterUserId);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<bool>> HasReporterAlreadyReportedAsync(
        int reporterUserId, ReportedContentType contentType, int contentId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var exists = await context.ContentReports.AnyAsync(
                r => r.ReporterUserId == reporterUserId && r.ContentType == contentType && r.ContentId == contentId,
                ctoken);

            return RepositoryResult<bool>.Success(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: HasReporterAlreadyReportedAsync -> Something went wrong when checking for an existing report by user {reporterUserId}.", reporterUserId);
            return RepositoryResult<bool>.Error();
        }
    }

    // The report row and the hiding go in one SaveChangesAsync, so the queue can never hold
    // a report for content that is still visible.
    public async Task<RepositoryResult<ContentReport>> AddReportAsync(
        ContentReport report, bool hideContent, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            context.ContentReports.Add(report);

            if (hideContent && !await SetModerationStateAsync(context, report.ContentType, report.ContentId, ModerationState.HiddenPendingReview, ctoken))
                return RepositoryResult<ContentReport>.NotFound();

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<ContentReport>.Success(report);
        }
        catch (DbUpdateException ex)
        {
            // The unique index is what actually holds one report per user per piece of
            // content; the check in the service leaves a window, and a double tap on a phone
            // button is exactly how you land in it. Re-read rather than parse a provider
            // error code, because this has to behave the same on Npgsql and SQLite.
            if (await IsDuplicateAsync(report, ctoken))
            {
                _logger.LogInformation("ContentReportRepository: AddReportAsync -> Duplicate report by user {reporterUserId} on {contentType} {contentId}.", report.ReporterUserId, report.ContentType, report.ContentId);
                return RepositoryResult<ContentReport>.Conflict();
            }

            _logger.LogError(ex, "ContentReportRepository: AddReportAsync -> Something went wrong when saving the report.");
            return RepositoryResult<ContentReport>.Error();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: AddReportAsync -> Something went wrong when saving the report.");
            return RepositoryResult<ContentReport>.Error();
        }
    }

    public async Task<RepositoryResult<PagedResult<ContentReportSummary>>> GetPagedAsync(
        ReportStatus? status,
        ReportedContentType? contentType,
        ReportHideOutcome? hideOutcome,
        int page,
        int pageSize,
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var query = Queue(context);

            if (status.HasValue)
                query = query.Where(r => r.Status == status.Value);

            if (contentType.HasValue)
                query = query.Where(r => r.ContentType == contentType.Value);

            if (hideOutcome.HasValue)
                query = query.Where(r => r.HideOutcome == hideOutcome.Value);

            var total = await query.CountAsync(ctoken);

            var rows = await query
                .OrderBy(r => r.Status)
                .ThenBy(r => r.CreatedAt)
                .ThenBy(r => r.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(Summary(context))
                .ToListAsync(ctoken);

            var items = await WithContentExistenceAsync(context, rows, ctoken);

            return RepositoryResult<PagedResult<ContentReportSummary>>.Success(
                new PagedResult<ContentReportSummary>(items, page, (page * pageSize) < total, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetPagedAsync -> Something went wrong when listing reports.");
            return RepositoryResult<PagedResult<ContentReportSummary>>.Error();
        }
    }

    public async Task<RepositoryResult<ContentReportSummary>> GetSummaryByIdentifierAsync(
        string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var row = await Queue(context)
                .Where(r => r.Identifier == identifier)
                .Select(Summary(context))
                .FirstOrDefaultAsync(ctoken);

            if (row is null)
                return RepositoryResult<ContentReportSummary>.NotFound();

            var summaries = await WithContentExistenceAsync(context, [row], ctoken);

            return RepositoryResult<ContentReportSummary>.Success(summaries[0]);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetSummaryByIdentifierAsync -> Something went wrong when fetching report {identifier}.", identifier);
            return RepositoryResult<ContentReportSummary>.Error();
        }
    }

    public async Task<RepositoryResult<ContentReport>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var report = await context.ContentReports
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Identifier == identifier, ctoken);

            return report is null
                ? RepositoryResult<ContentReport>.NotFound()
                : RepositoryResult<ContentReport>.Success(report);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetByIdentifierAsync -> Something went wrong when fetching report {identifier}.", identifier);
            return RepositoryResult<ContentReport>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyDictionary<ReportStatus, int>>> GetCountsByStatusAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var counted = await context.ContentReports
                .GroupBy(r => r.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(ctoken);

            // Every status appears, so a tab that happens to be empty still renders a zero
            // rather than nothing.
            var counts = Enum.GetValues<ReportStatus>()
                .ToDictionary(status => status, status => counted.FirstOrDefault(c => c.Status == status)?.Count ?? 0);

            return RepositoryResult<IReadOnlyDictionary<ReportStatus, int>>.Success(counts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetCountsByStatusAsync -> Something went wrong when counting reports.");
            return RepositoryResult<IReadOnlyDictionary<ReportStatus, int>>.Error();
        }
    }

    // Distinct content, not rows. One decision settles every pending report on the same
    // content, so a review three people reported would otherwise read as three strikes and
    // drive a decision to delete someone's account.
    public async Task<RepositoryResult<int>> CountUpheldContentByAuthorAsync(int authorUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var strikes = await context.ContentReports
                .Where(r => r.ContentAuthorUserId == authorUserId && r.Status == ReportStatus.Upheld)
                .Select(r => new { r.ContentType, r.ContentId })
                .Distinct()
                .CountAsync(ctoken);

            return RepositoryResult<int>.Success(strikes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: CountUpheldContentByAuthorAsync -> Something went wrong when counting strikes for user {authorUserId}.", authorUserId);
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<ReporterRecord>> GetReporterRecordAsync(int reporterUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var byStatus = await context.ContentReports
                .Where(r => r.ReporterUserId == reporterUserId)
                .GroupBy(r => r.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(ctoken);

            int Of(ReportStatus status) => byStatus.FirstOrDefault(c => c.Status == status)?.Count ?? 0;

            return RepositoryResult<ReporterRecord>.Success(new ReporterRecord(
                byStatus.Sum(c => c.Count),
                Of(ReportStatus.Pending),
                Of(ReportStatus.Dismissed),
                Of(ReportStatus.Upheld)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetReporterRecordAsync -> Something went wrong when reading the record for user {reporterUserId}.", reporterUserId);
            return RepositoryResult<ReporterRecord>.Error();
        }
    }

    // Grouped in the database and paged on the aggregate, so the tab stays bounded however
    // many reports exist. The nicknames come from a second query on the page's ids rather
    // than a correlated subquery, which keeps the group-by translatable on every provider.
    public async Task<RepositoryResult<PagedResult<ReporterStatistic>>> GetReporterStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var grouped = context.ContentReports
                .Where(r => r.ReporterUserId != null)
                .GroupBy(r => r.ReporterUserId!.Value)
                .Select(g => new
                {
                    ReporterUserId = g.Key,
                    Total = g.Count(),
                    Pending = g.Count(r => r.Status == ReportStatus.Pending),
                    Dismissed = g.Count(r => r.Status == ReportStatus.Dismissed),
                    Upheld = g.Count(r => r.Status == ReportStatus.Upheld),
                    LastReportedAt = g.Max(r => r.CreatedAt),
                });

            var total = await grouped.CountAsync(ctoken);

            // Most dismissed first: the tab exists to find the account whose reports keep
            // turning out to be wrong.
            var rows = await grouped
                .OrderByDescending(g => g.Dismissed)
                .ThenByDescending(g => g.Total)
                .ThenBy(g => g.ReporterUserId)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ctoken);

            var names = await NickNamesByIdAsync(context, rows.Select(r => r.ReporterUserId), ctoken);

            var items = rows
                .Select(r => new ReporterStatistic(
                    r.ReporterUserId,
                    names.GetValueOrDefault(r.ReporterUserId),
                    r.Total,
                    r.Pending,
                    r.Dismissed,
                    r.Upheld,
                    r.LastReportedAt))
                .ToList();

            return RepositoryResult<PagedResult<ReporterStatistic>>.Success(
                new PagedResult<ReporterStatistic>(items, page, (page * pageSize) < total, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetReporterStatisticsAsync -> Something went wrong when listing reporters.");
            return RepositoryResult<PagedResult<ReporterStatistic>>.Error();
        }
    }

    // Distinct content before the grouping, for the same reason CountUpheldContentByAuthorAsync
    // does it: one decision settles every report on the same content, so counting rows would
    // read a review three people reported as three strikes.
    public async Task<RepositoryResult<PagedResult<AuthorStatistic>>> GetAuthorStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var grouped = context.ContentReports
                .Where(r => r.Status == ReportStatus.Upheld && r.ContentAuthorUserId != null)
                .Select(r => new { AuthorUserId = r.ContentAuthorUserId!.Value, r.ContentType, r.ContentId })
                .Distinct()
                .GroupBy(x => x.AuthorUserId)
                .Select(g => new { AuthorUserId = g.Key, Strikes = g.Count() });

            var total = await grouped.CountAsync(ctoken);

            var rows = await grouped
                .OrderByDescending(g => g.Strikes)
                .ThenBy(g => g.AuthorUserId)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ctoken);

            var ids = rows.Select(r => r.AuthorUserId).ToList();
            var names = await NickNamesByIdAsync(context, ids, ctoken);
            var accounts = await AccountStatesByIdAsync(context, ids, ctoken);

            // The snapshot only covers the window between a rename and the lookup above
            // failing; once the author deletes their account it is nulled too, and the row
            // then names nobody on purpose.
            var snapshots = await context.ContentReports
                .Where(r => r.ContentAuthorUserId != null
                    && ids.Contains(r.ContentAuthorUserId.Value)
                    && r.AuthorNickNameSnapshot != null)
                .GroupBy(r => r.ContentAuthorUserId!.Value)
                .Select(g => new { AuthorUserId = g.Key, NickName = g.Max(r => r.AuthorNickNameSnapshot) })
                .ToDictionaryAsync(x => x.AuthorUserId, x => x.NickName, ctoken);

            var items = rows
                .Select(r => new AuthorStatistic(
                    r.AuthorUserId,
                    accounts.GetValueOrDefault(r.AuthorUserId)?.Identifier,
                    names.GetValueOrDefault(r.AuthorUserId) ?? snapshots.GetValueOrDefault(r.AuthorUserId),
                    r.Strikes,
                    accounts.GetValueOrDefault(r.AuthorUserId)?.BannedAt,
                    accounts.GetValueOrDefault(r.AuthorUserId)?.BanCount ?? 0))
                .ToList();

            return RepositoryResult<PagedResult<AuthorStatistic>>.Success(
                new PagedResult<AuthorStatistic>(items, page, (page * pageSize) < total, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: GetAuthorStatisticsAsync -> Something went wrong when listing authors.");
            return RepositoryResult<PagedResult<AuthorStatistic>>.Error();
        }
    }

    private static async Task<Dictionary<int, string?>> NickNamesByIdAsync(
        StigViddDbContext context, IEnumerable<int> userIds, CancellationToken ctoken)
    {
        var ids = userIds.ToList();

        if (ids.Count == 0)
            return [];

        return await context.Users
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.NickName })
            .ToDictionaryAsync(u => u.Id, u => (string?)u.NickName, ctoken);
    }

    // What the Authors tab needs about the account behind a row: who it is, and whether it is banned.
    private record AccountState(string Identifier, DateTime? BannedAt, int BanCount);

    // Absent for an account that is gone, which is also when there is nothing to ban.
    private static async Task<Dictionary<int, AccountState>> AccountStatesByIdAsync(
        StigViddDbContext context, IEnumerable<int> userIds, CancellationToken ctoken)
    {
        var ids = userIds.ToList();

        if (ids.Count == 0)
            return [];

        return await context.Users
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.Identifier, BannedAt = u.Bans.Where(b => b.LiftedAt == null).Select(b => (DateTime?)b.BannedAt).FirstOrDefault(), BanCount = u.Bans.Count })
            .ToDictionaryAsync(u => u.Id, u => new AccountState(u.Identifier, u.BannedAt, u.BanCount), ctoken);
    }

    // The decision applies to the CONTENT, not the row: every pending report on the same
    // content is settled in the same save, or the same content sits in the queue once per
    // reporter. Upholding hard-deletes; the image URLs come back so the caller can clear
    // them off WebDAV afterwards.
    public async Task<RepositoryResult<DecisionOutcome>> ApplyDecisionAsync(
        ReportedContentType contentType,
        int contentId,
        ReportStatus decision,
        string decidedBy,
        string? decisionNote,
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var effects = new ContentDeletionEffects();
            var applied = decision;

            if (decision == ReportStatus.Upheld)
            {
                var handler = _handlers.For(contentType);
                var deleted = handler is not null && await handler.DeleteAsync(context, contentId, effects, ctoken);

                // Retention may already have taken an obstacle, or the author may have
                // deleted their account. The strike still lands, so this is not a failure.
                if (!deleted)
                    _logger.LogInformation("ContentReportRepository: ApplyDecisionAsync -> {contentType} {contentId} was already gone; recording the decision only.", contentType, contentId);
            }
            else if (decision == ReportStatus.Dismissed)
            {
                applied = await SetModerationStateAsync(context, contentType, contentId, ModerationState.Visible, ctoken)
                    ? ReportStatus.Dismissed
                    : ReportStatus.ContentExpired;
            }

            var pending = await context.ContentReports
                .Where(r => r.ContentType == contentType && r.ContentId == contentId && r.Status == ReportStatus.Pending)
                .ToListAsync(ctoken);

            var decidedAt = DateTime.UtcNow;

            foreach (var report in pending)
            {
                report.Status = applied;
                report.DecidedBy = decidedBy;
                report.DecidedAt = decidedAt;
                report.DecisionNote = decisionNote;
            }

            await context.SaveChangesAsync(ctoken);

            var unreferencedUrls = new List<string>();

            foreach (var url in effects.ImageUrls)
            {
                if (!await ImageReferences.IsReferencedAsync(context, url, ctoken))
                    unreferencedUrls.Add(url);
            }

            return RepositoryResult<DecisionOutcome>.Success(new DecisionOutcome(applied, unreferencedUrls, pending.Count, effects.Pushes));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: ApplyDecisionAsync -> Something went wrong when deciding {contentType} {contentId}.", contentType, contentId);
            return RepositoryResult<DecisionOutcome>.Error();
        }
    }

    // Reports are never filtered; the queue always sees everything. keep-comment: whether content still exists is each handler's ExistingIdsAsync
    private static IQueryable<ContentReport> Queue(StigViddDbContext context) =>
        context.ContentReports.IgnoreQueryFilters(["Moderation"]).AsNoTracking();

    // The nickname is looked up on the id first: the snapshot is what the name was when the
    // report was written, and it is nulled outright once the author deletes their account.
    // The strike list is what decides whether to remove someone, so it must not be vague.
    private static System.Linq.Expressions.Expression<Func<ContentReport, QueueRow>> Summary(StigViddDbContext context) =>
        r => new QueueRow(r.ContentType, r.ContentId, new ContentReportSummary(
            r.Identifier,
            r.ContentType,
            r.ContentIdentifier,
            r.TrailIdentifier,
            r.Reason,
            r.ReporterNote,
            r.Status,
            r.HideOutcome,
            r.Reporter != null ? r.Reporter.NickName : null,
            context.Users.Where(u => u.Id == r.ContentAuthorUserId).Select(u => u.NickName).FirstOrDefault()
                ?? r.AuthorNickNameSnapshot,
            context.Users.Where(u => u.Id == r.ContentAuthorUserId).Select(u => u.Identifier).FirstOrDefault(),
            context.UserBans.Where(b => b.UserId == r.ContentAuthorUserId && b.LiftedAt == null).Select(b => (DateTime?)b.BannedAt).FirstOrDefault(),
            r.ContentSnapshot,
            false,
            r.DecidedBy,
            r.DecidedAt,
            r.DecisionNote,
            r.CreatedAt));

    private record QueueRow(ReportedContentType ContentType, int ContentId, ContentReportSummary Summary);

    // One existence query per content type on the page, through that type's handler. keep-comment: why it is not in the projection
    private async Task<List<ContentReportSummary>> WithContentExistenceAsync(
        StigViddDbContext context, IReadOnlyList<QueueRow> rows, CancellationToken ctoken)
    {
        var existing = new HashSet<(ReportedContentType, int)>();

        foreach (var group in rows.GroupBy(r => r.ContentType))
        {
            var handler = _handlers.For(group.Key);

            if (handler is null)
                continue;

            var ids = await handler.ExistingIdsAsync(context, group.Select(r => r.ContentId).Distinct().ToList(), ctoken);

            foreach (var id in ids)
                existing.Add((group.Key, id));
        }

        return rows
            .Select(r => r.Summary with { ContentStillExists = existing.Contains((r.ContentType, r.ContentId)) })
            .ToList();
    }

    private async Task<bool> SetModerationStateAsync(
        StigViddDbContext context, ReportedContentType contentType, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var handler = _handlers.For(contentType);

        return handler is not null && await handler.SetModerationStateAsync(context, contentId, state, ctoken);
    }

    private async Task<bool> IsDuplicateAsync(ContentReport report, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            return await context.ContentReports.AnyAsync(
                r => r.ReporterUserId == report.ReporterUserId
                     && r.ContentType == report.ContentType
                     && r.ContentId == report.ContentId,
                ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ContentReportRepository: IsDuplicateAsync -> Something went wrong when re-reading after a failed insert.");
            return false;
        }
    }
}
