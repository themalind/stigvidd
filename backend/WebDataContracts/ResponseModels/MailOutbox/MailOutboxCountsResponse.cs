// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailOutbox;

/// <summary>
/// One count per status, so the page can say what is outstanding without listing it.
/// </summary>
public class MailOutboxCountsResponse
{
    public int Pending { get; set; }
    public int Sending { get; set; }
    public int Sent { get; set; }
    public int Failed { get; set; }
    public int Cancelled { get; set; }
    public int Total { get; set; }

    public static MailOutboxCountsResponse Create(
        int pending, int sending, int sent, int failed, int cancelled) => new()
        {
            Pending = pending,
            Sending = sending,
            Sent = sent,
            Failed = failed,
            Cancelled = cancelled,
            Total = pending + sending + sent + failed + cancelled,
        };
}
