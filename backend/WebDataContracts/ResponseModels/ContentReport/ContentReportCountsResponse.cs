// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.ContentReport;

public class ContentReportCountsResponse
{
    public int Pending { get; set; }
    public int Dismissed { get; set; }
    public int Upheld { get; set; }
    public int ContentExpired { get; set; }

    public static ContentReportCountsResponse Create(int pending, int dismissed, int upheld, int contentExpired)
    {
        return new ContentReportCountsResponse
        {
            Pending = pending,
            Dismissed = dismissed,
            Upheld = upheld,
            ContentExpired = contentExpired
        };
    }
}
