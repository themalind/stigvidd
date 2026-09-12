// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Runtime.CompilerServices;
using WebDataContracts.RequestModels.ContentReport;
using WebDataContracts.ResponseModels.ContentReport;

namespace Core.Services;

public class ContentReportService : IContentReportService
{
    private const int DefaultMaxReportsPerUserPerDay = 5;
    private const int DefaultDismissedReportsBeforeHideIsWithheld = 3;
    private const int DefaultSnapshotMaxLength = 2000;

    // Rolling, like ActiveObstacles, not a calendar day.
    private static readonly TimeSpan DayWindow = TimeSpan.FromHours(24);

    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 100;

    private readonly IContentReportRepository _reportRepository;
    private readonly IUserService _userService;
    private readonly IWebDavService _webDavService;
    private readonly ContentReportResponseFactory _responseFactory;
    private readonly ILogger<ContentReportService> _logger;
    private readonly int _maxReportsPerUserPerDay;
    private readonly int _dismissedReportsBeforeHideIsWithheld;
    private readonly int _snapshotMaxLength;

    public ContentReportService(
        IContentReportRepository reportRepository,
        IUserService userService,
        IWebDavService webDavService,
        ContentReportResponseFactory responseFactory,
        ILogger<ContentReportService> logger,
        IConfiguration configuration)
    {
        _reportRepository = reportRepository;
        _userService = userService;
        _webDavService = webDavService;
        _responseFactory = responseFactory;
        _logger = logger;
        _maxReportsPerUserPerDay = int.TryParse(configuration["ContentReports:MaxReportsPerUserPerDay"], out var max)
            ? max : DefaultMaxReportsPerUserPerDay;
        _dismissedReportsBeforeHideIsWithheld = int.TryParse(configuration["ContentReports:DismissedReportsBeforeHideIsWithheld"], out var threshold)
            ? threshold : DefaultDismissedReportsBeforeHideIsWithheld;
        _snapshotMaxLength = int.TryParse(configuration["ContentReports:SnapshotMaxLength"], out var length)
            ? length : DefaultSnapshotMaxLength;
    }

    public async Task<Result<ContentReportResponse?>> CreateAsync(
        string reporterIdentifier, CreateContentReportRequest request, CancellationToken ctoken)
    {
        if (!Enum.TryParse<ReportedContentType>(request.ContentType, out var contentType)
            || contentType == ReportedContentType.Unknown)
            return Result.Fail<ContentReportResponse?>(new Message(400, $"Unknown content type {request.ContentType}."));

        var reason = Enum.TryParse<ReportReason>(request.Reason, out var parsedReason) ? parsedReason : ReportReason.Other;

        var reporterIdResult = await _userService.GetUserIdByIdentifierAsync(reporterIdentifier, ctoken);

        if (!reporterIdResult.Success)
            return Result.Fail<ContentReportResponse?>(new Message(404, "Reporter not found."));

        var reporterUserId = reporterIdResult.Value;

        var capResult = await IsOverDailyCapAsync(reporterUserId, ctoken);

        if (capResult.IsFailure && capResult.Message != null)
            return Result.Fail<ContentReportResponse?>(capResult.Message);

        var contentResult = await _reportRepository.GetReportableContentAsync(contentType, request.ContentIdentifier, ctoken);

        if (contentResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<ContentReportResponse?>(new Message(500, "An error occurred while fetching the reported content."));

        if (!contentResult.IsSuccess)
            return Result.Fail<ContentReportResponse?>(new Message(404, $"{request.ContentType} with identifier {request.ContentIdentifier} not found."));

        var content = contentResult.Value;

        if (content.AuthorUserId == reporterUserId)
            return Result.Fail<ContentReportResponse?>(new Message(400, "You cannot report your own content."));

        var alreadyReported = await _reportRepository.HasReporterAlreadyReportedAsync(
            reporterUserId, contentType, content.ContentId, ctoken);

        if (!alreadyReported.IsSuccess)
            return Result.Fail<ContentReportResponse?>(new Message(500, "An error occurred while checking for an existing report."));

        if (alreadyReported.Value)
            return Result.Fail<ContentReportResponse?>(new Message(409, "You have already reported this content."));

        var hideOutcomeResult = await DecideHideOutcomeAsync(reporterUserId, content.ModerationState, ctoken);

        if (hideOutcomeResult.IsFailure && hideOutcomeResult.Message != null)
            return Result.Fail<ContentReportResponse?>(hideOutcomeResult.Message);

        var hideOutcome = hideOutcomeResult.Value;

        var report = new ContentReport
        {
            ContentType = contentType,
            ContentId = content.ContentId,
            ContentIdentifier = content.ContentIdentifier,
            TrailId = content.TrailId,
            TrailIdentifier = content.TrailIdentifier,
            ContentSnapshot = Clip(content.Snapshot),
            AuthorNickNameSnapshot = content.AuthorNickName,
            ContentAuthorUserId = content.AuthorUserId,
            ReporterUserId = reporterUserId,
            Reason = reason,
            ReporterNote = request.ReporterNote,
            Status = ReportStatus.Pending,
            HideOutcome = hideOutcome,
        };

        var addResult = await _reportRepository.AddReportAsync(report, hideOutcome == ReportHideOutcome.Hidden, ctoken);

        if (addResult.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<ContentReportResponse?>(new Message(409, "You have already reported this content."));

        if (addResult.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<ContentReportResponse?>(new Message(404, $"{request.ContentType} with identifier {request.ContentIdentifier} not found."));

        if (!addResult.IsSuccess)
            return Result.Fail<ContentReportResponse?>(new Message(500, "An error occurred while saving the report."));

        return Result.Ok<ContentReportResponse?>(_responseFactory.Create(addResult.Value));
    }

    public async Task<Result<PagedResult<ContentReportSummaryResponse>>> GetQueueAsync(
        string? status, string? contentType, string? hideOutcome, int page, int pageSize, CancellationToken ctoken)
    {
        // An unknown filter value is a 400 rather than a silently ignored filter, or the
        // operator reads a full queue as an empty one.
        if (!TryParseFilter<ReportStatus>(status, out var parsedStatus))
            return BadFilter<PagedResult<ContentReportSummaryResponse>>(nameof(status), Enum.GetNames<ReportStatus>());

        if (!TryParseFilter<ReportedContentType>(contentType, out var parsedContentType))
            return BadFilter<PagedResult<ContentReportSummaryResponse>>(nameof(contentType), Enum.GetNames<ReportedContentType>());

        if (!TryParseFilter<ReportHideOutcome>(hideOutcome, out var parsedHideOutcome))
            return BadFilter<PagedResult<ContentReportSummaryResponse>>(nameof(hideOutcome), Enum.GetNames<ReportHideOutcome>());

        var result = await _reportRepository.GetPagedAsync(
            parsedStatus, parsedContentType, parsedHideOutcome, Math.Max(page, 1), ClampPageSize(pageSize), ctoken);

        if (!result.IsSuccess)
            return Result.Fail<PagedResult<ContentReportSummaryResponse>>(new Message(500, "The reports could not be listed."));

        return Result.Ok(new PagedResult<ContentReportSummaryResponse>(
            _responseFactory.Create(result.Value.Items),
            result.Value.Page,
            result.Value.HasMore,
            result.Value.TotalCount));
    }

    public async Task<Result<ContentReportDetailResponse>> GetDetailAsync(string identifier, CancellationToken ctoken)
    {
        var summaryResult = await _reportRepository.GetSummaryByIdentifierAsync(identifier, ctoken);

        if (summaryResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<ContentReportDetailResponse>(new Message(500, "The report could not be read."));

        if (!summaryResult.IsSuccess)
            return Result.Fail<ContentReportDetailResponse>(new Message(404, $"No report with identifier {identifier}."));

        return await WithStatisticsAsync(summaryResult.Value, identifier, ctoken);
    }

    public async Task<Result<ContentReportCountsResponse>> GetCountsAsync(CancellationToken ctoken)
    {
        var result = await _reportRepository.GetCountsByStatusAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<ContentReportCountsResponse>(new Message(500, "The report counts could not be read."));

        return Result.Ok(_responseFactory.Create(result.Value));
    }

    // The withholding threshold is the same number the hide decision reads, so a reporter
    // marked here is exactly one whose next report will not hide anything.
    public async Task<Result<PagedResult<ReporterStatisticResponse>>> GetReporterStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken)
    {
        var result = await _reportRepository.GetReporterStatisticsAsync(
            Math.Max(page, 1), ClampPageSize(pageSize), ctoken);

        if (!result.IsSuccess)
            return Result.Fail<PagedResult<ReporterStatisticResponse>>(new Message(500, "The reporters could not be listed."));

        var items = result.Value.Items
            .Select(reporter => _responseFactory.Create(
                reporter,
                reporter.Dismissed >= _dismissedReportsBeforeHideIsWithheld))
            .ToList();

        return Result.Ok(new PagedResult<ReporterStatisticResponse>(
            items, result.Value.Page, result.Value.HasMore, result.Value.TotalCount));
    }

    public async Task<Result<PagedResult<AuthorStatisticResponse>>> GetAuthorStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken)
    {
        var result = await _reportRepository.GetAuthorStatisticsAsync(
            Math.Max(page, 1), ClampPageSize(pageSize), ctoken);

        if (!result.IsSuccess)
            return Result.Fail<PagedResult<AuthorStatisticResponse>>(new Message(500, "The authors could not be listed."));

        return Result.Ok(new PagedResult<AuthorStatisticResponse>(
            _responseFactory.Create(result.Value.Items),
            result.Value.Page,
            result.Value.HasMore,
            result.Value.TotalCount));
    }

    // Idempotent: the same decision again changes nothing and does not rewrite who decided.
    // A contradicting decision is a 409, because upholding hard-deletes and there is nothing
    // left to dismiss afterwards.
    public async Task<Result<ContentReportDetailResponse>> DecideAsync(
        string identifier, DecideContentReportRequest request, string decidedBy, CancellationToken ctoken)
    {
        if (!TryParseDecision(request.Decision, out var decision))
            return Result.Fail<ContentReportDetailResponse>(new Message(400, "Decision must be Dismiss or Uphold."));

        var reportResult = await _reportRepository.GetByIdentifierAsync(identifier, ctoken);

        if (reportResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<ContentReportDetailResponse>(new Message(500, "The report could not be read."));

        if (!reportResult.IsSuccess)
            return Result.Fail<ContentReportDetailResponse>(new Message(404, $"No report with identifier {identifier}."));

        var report = reportResult.Value;

        switch (Classify(report.Status, decision))
        {
            case DecisionRoute.NoOp:
                return await GetDetailAsync(identifier, ctoken);

            case DecisionRoute.Conflict:
                return Result.Fail<ContentReportDetailResponse>(new Message(409,
                    $"This report is already {report.Status} and cannot be {request.Decision}ed."));
        }

        var outcome = await _reportRepository.ApplyDecisionAsync(
            report.ContentType, report.ContentId, decision, decidedBy, request.DecisionNote, ctoken);

        if (!outcome.IsSuccess)
            return Result.Fail<ContentReportDetailResponse>(new Message(500, "The decision could not be applied."));

        // After the row is gone, not before: a failure here leaves a recoverable file, while
        // deleting first and failing to save would lose the images of content that stays up.
        await DeleteImageFilesAsync(
            outcome.Value.DeletedImageUrls,
            $"ReportIdentifier: {identifier}, ContentType: {report.ContentType}, ContentId: {report.ContentId}");

        return await GetDetailAsync(identifier, ctoken);
    }

    private enum DecisionRoute { Apply, NoOp, Conflict }

    // Upholding is still allowed on ContentExpired: the content went before anyone decided,
    // but the strike must still land or a repeat author gets off on timing alone.
    private static DecisionRoute Classify(ReportStatus current, ReportStatus decision) => current switch
    {
        ReportStatus.Pending => DecisionRoute.Apply,
        ReportStatus.ContentExpired when decision == ReportStatus.Upheld => DecisionRoute.Apply,
        _ when current == decision => DecisionRoute.NoOp,
        _ => DecisionRoute.Conflict,
    };

    private static bool TryParseDecision(string? decision, out ReportStatus parsed)
    {
        parsed = ReportStatus.Pending;

        if (string.Equals(decision, "Dismiss", StringComparison.OrdinalIgnoreCase))
            parsed = ReportStatus.Dismissed;
        else if (string.Equals(decision, "Uphold", StringComparison.OrdinalIgnoreCase))
            parsed = ReportStatus.Upheld;
        else
            return false;

        return true;
    }

    private async Task<Result<ContentReportDetailResponse>> WithStatisticsAsync(
        ContentReportSummary summary, string identifier, CancellationToken ctoken)
    {
        var raw = await _reportRepository.GetByIdentifierAsync(identifier, ctoken);

        if (!raw.IsSuccess)
            return Result.Fail<ContentReportDetailResponse>(new Message(500, "The report could not be read."));

        var strikes = 0;

        if (raw.Value.ContentAuthorUserId is { } authorUserId)
        {
            var strikeResult = await _reportRepository.CountUpheldContentByAuthorAsync(authorUserId, ctoken);

            if (!strikeResult.IsSuccess)
                return Result.Fail<ContentReportDetailResponse>(new Message(500, "The author's record could not be read."));

            strikes = strikeResult.Value;
        }

        var record = new ReporterRecord(0, 0, 0, 0);

        if (raw.Value.ReporterUserId is { } reporterUserId)
        {
            var recordResult = await _reportRepository.GetReporterRecordAsync(reporterUserId, ctoken);

            if (!recordResult.IsSuccess)
                return Result.Fail<ContentReportDetailResponse>(new Message(500, "The reporter's record could not be read."));

            record = recordResult.Value;
        }

        return Result.Ok(_responseFactory.Create(summary, strikes, record));
    }

    // Best-effort file removal, the same shape ReviewService uses: a leftover file is
    // recoverable, so a WebDAV failure is logged rather than surfaced. Nothing else in the
    // repo would notice these going missing, so the log line is the only trace.
    private async Task DeleteImageFilesAsync(
        IEnumerable<string> urls,
        string context,
        [CallerMemberName] string operation = "")
    {
        foreach (var url in urls)
        {
            try
            {
                var result = await _webDavService.DeleteFileAsync(url);

                if (result.IsFailure)
                    _logger.LogError("{Operation}: WebDAV refused to delete image {Url}. {Context}", operation, url, context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "{Operation}: Failed to delete image {Url}. {Context}", operation, url, context);
            }
        }
    }

    private static Result<T> BadFilter<T>(string name, string[] allowed) =>
        Result.Fail<T>(new Message(400, $"Unknown {name}. Use one of: {string.Join(", ", allowed)}."));

    private static int ClampPageSize(int pageSize) =>
        pageSize <= 0 ? DefaultPageSize : Math.Min(pageSize, MaxPageSize);

    private static bool TryParseFilter<T>(string? value, out T? parsed) where T : struct, Enum
    {
        parsed = null;

        if (string.IsNullOrWhiteSpace(value))
            return true;

        if (!Enum.TryParse<T>(value, ignoreCase: true, out var result) || !Enum.IsDefined(result))
            return false;

        parsed = result;
        return true;
    }

    // Zero means no cap, and short-circuits before touching the database.
    private async Task<Result> IsOverDailyCapAsync(int reporterUserId, CancellationToken ctoken)
    {
        if (_maxReportsPerUserPerDay <= 0)
            return Result.Ok();

        var countResult = await _reportRepository.CountReportsByReporterSinceAsync(
            reporterUserId, DateTime.UtcNow - DayWindow, ctoken);

        if (!countResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while counting your recent reports."));

        return countResult.Value >= _maxReportsPerUserPerDay
            ? Result.Fail(new Message(429, "You have reported too much content today. Try again later."))
            : Result.Ok();
    }

    // A reporter whose reports keep being dismissed still gets a row in the queue, it just
    // stops hiding anything. Zero disables that, like the daily cap.
    private async Task<Result<ReportHideOutcome>> DecideHideOutcomeAsync(
        int reporterUserId, ModerationState currentState, CancellationToken ctoken)
    {
        if (currentState == ModerationState.HiddenPendingReview)
            return Result.Ok(ReportHideOutcome.AlreadyHidden);

        if (_dismissedReportsBeforeHideIsWithheld <= 0)
            return Result.Ok(ReportHideOutcome.Hidden);

        var dismissedResult = await _reportRepository.CountDismissedReportsByReporterAsync(reporterUserId, ctoken);

        if (!dismissedResult.IsSuccess)
            return Result.Fail<ReportHideOutcome>(new Message(500, "An error occurred while reading your report history."));

        return dismissedResult.Value >= _dismissedReportsBeforeHideIsWithheld
            ? Result.Ok(ReportHideOutcome.WithheldReporterDismissed)
            : Result.Ok(ReportHideOutcome.Hidden);
    }

    private string? Clip(string? snapshot) =>
        snapshot is not null && snapshot.Length > _snapshotMaxLength
            ? snapshot[.._snapshotMaxLength]
            : snapshot;
}
