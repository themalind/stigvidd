// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

// The queue row plus what a moderator needs before deciding: how often this author has been
// upheld against, and how often this reporter has been right.
public class ContentReportDetailResponse
{
    public required ContentReportSummaryResponse Report { get; set; }
    public int AuthorStrikes { get; set; }
    public int ReporterTotal { get; set; }
    public int ReporterPending { get; set; }
    public int ReporterDismissed { get; set; }
    public int ReporterUpheld { get; set; }

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
