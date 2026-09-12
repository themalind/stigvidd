// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.ResponseModels.ContentReport;

namespace Core.Factories;

public class ContentReportResponseFactory
{
    public ContentReportResponse Create(ContentReport report)
    {
        return ContentReportResponse.Create(
            report.Identifier,
            report.ContentType.ToString(),
            report.ContentIdentifier,
            report.Reason.ToString(),
            report.ReporterNote,
            report.Status.ToString(),
            report.HideOutcome.ToString(),
            report.CreatedAt);
    }

    public ContentReportSummaryResponse Create(ContentReportSummary summary)
    {
        return ContentReportSummaryResponse.Create(
            summary.Identifier,
            summary.ContentType.ToString(),
            summary.ContentIdentifier,
            summary.TrailIdentifier,
            summary.Reason.ToString(),
            summary.ReporterNote,
            summary.Status.ToString(),
            summary.HideOutcome.ToString(),
            summary.ReporterNickName,
            summary.AuthorNickName,
            summary.ContentSnapshot,
            summary.ContentStillExists,
            summary.DecidedBy,
            summary.DecidedAt,
            summary.DecisionNote,
            summary.CreatedAt);
    }

    public IReadOnlyCollection<ContentReportSummaryResponse> Create(IReadOnlyCollection<ContentReportSummary> summaries) =>
        summaries.Select(Create).ToList();

    public ContentReportDetailResponse Create(ContentReportSummary summary, int authorStrikes, ReporterRecord reporter)
    {
        return ContentReportDetailResponse.Create(
            Create(summary),
            authorStrikes,
            reporter.Total,
            reporter.Pending,
            reporter.Dismissed,
            reporter.Upheld);
    }

    // The withholding flag is the service's to decide: the threshold is configuration, and
    // a factory that read it would put the rule in two places.
    public ReporterStatisticResponse Create(ReporterStatistic reporter, bool reportsAreWithheld)
    {
        return ReporterStatisticResponse.Create(
            reporter.NickName,
            reporter.Total,
            reporter.Pending,
            reporter.Dismissed,
            reporter.Upheld,
            reporter.LastReportedAt,
            reportsAreWithheld);
    }

    public AuthorStatisticResponse Create(AuthorStatistic author) =>
        AuthorStatisticResponse.Create(author.NickName, author.Strikes);

    public IReadOnlyCollection<AuthorStatisticResponse> Create(IReadOnlyCollection<AuthorStatistic> authors) =>
        authors.Select(Create).ToList();

    public ContentReportCountsResponse Create(IReadOnlyDictionary<ReportStatus, int> counts)
    {
        int Of(ReportStatus status) => counts.TryGetValue(status, out var count) ? count : 0;

        return ContentReportCountsResponse.Create(
            Of(ReportStatus.Pending),
            Of(ReportStatus.Dismissed),
            Of(ReportStatus.Upheld),
            Of(ReportStatus.ContentExpired));
    }
}
