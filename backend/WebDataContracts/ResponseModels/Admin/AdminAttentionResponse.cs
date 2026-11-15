// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Admin;

// keep-comment: work waiting for an admin, shown as badges in the admin menu and under "Needs attention" on the dashboard
public class AdminAttentionResponse
{
    public required int PendingHikeSubmissions { get; init; }
    public required int PendingReports { get; init; }
    public required int FailedMails { get; init; }
    public required int ImportsAwaitingReview { get; init; }
}
