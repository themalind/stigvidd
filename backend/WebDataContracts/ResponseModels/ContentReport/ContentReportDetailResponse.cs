// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

// The queue row plus what a moderator needs before deciding: how often this author has been
// upheld against, and how often this reporter has been right.
public class ContentReportDetailResponse
{
    public required ContentReportSummaryResponse Report { get; set; }
    public required int AuthorStrikes { get; set; }
    public required int ReporterTotal { get; set; }
    public required int ReporterPending { get; set; }
    public required int ReporterDismissed { get; set; }
    public required int ReporterUpheld { get; set; }

    public static ContentReportDetailResponse Create(
        ContentReportSummaryResponse report,
        int authorStrikes,
        int reporterTotal,
        int reporterPending,
        int reporterDismissed,
        int reporterUpheld)
    {
        return new ContentReportDetailResponse
        {
            Report = report,
            AuthorStrikes = authorStrikes,
            ReporterTotal = reporterTotal,
            ReporterPending = reporterPending,
            ReporterDismissed = reporterDismissed,
            ReporterUpheld = reporterUpheld
        };
    }
}
