// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.ContentReport;

public class DecideContentReportRequest
{
    // "Dismiss" puts the content back; "Uphold" deletes it permanently and records a strike.
    public required string Decision { get; set; }
    public string? DecisionNote { get; set; }
}
