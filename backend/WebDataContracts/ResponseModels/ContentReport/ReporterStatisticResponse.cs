// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

// One row in the Reporters tab. ReportsAreWithheld says this account's reports no longer
// hide anything, which is why their content can look unmoderated while the count climbs.
public class ReporterStatisticResponse
{
    public required string? NickName { get; set; }
    public required int Total { get; set; }
    public required int Pending { get; set; }
    public required int Dismissed { get; set; }
    public required int Upheld { get; set; }
    public required DateTime LastReportedAt { get; set; }
    public required bool ReportsAreWithheld { get; set; }

    public static ReporterStatisticResponse Create(
        string? nickName,
        int total,
        int pending,
        int dismissed,
        int upheld,
        DateTime lastReportedAt,
        bool reportsAreWithheld)
    {
        return new ReporterStatisticResponse
        {
            NickName = nickName,
            Total = total,
            Pending = pending,
            Dismissed = dismissed,
            Upheld = upheld,
            LastReportedAt = lastReportedAt,
            ReportsAreWithheld = reportsAreWithheld
        };
    }
}
