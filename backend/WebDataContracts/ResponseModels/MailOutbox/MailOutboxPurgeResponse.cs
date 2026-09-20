// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailOutbox;

/// <summary>
/// What a purge actually did. The cutoff is echoed back deliberately: it is what lets an
/// operator check that "30 days" meant what they thought before running it again with 7.
/// </summary>
public class MailOutboxPurgeResponse
{
    public int Deleted { get; set; }
    public int OlderThanDays { get; set; }
    public DateTime CutoffUtc { get; set; }

    public static MailOutboxPurgeResponse Create(int deleted, int olderThanDays, DateTime cutoffUtc) => new()
    {
        Deleted = deleted,
        OlderThanDays = olderThanDays,
        CutoffUtc = cutoffUtc,
    };
}
