// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailOutbox;

/// <summary>
/// One mail, without its rendered bodies.
/// </summary>
/// <remarks>
/// The bodies used to be here, and are now behind their own route. They are where the personal
/// data actually is — a nickname in the copy, and for verify-email and reset-password a live
/// token URL — so fetching one is a deliberate act that gets logged, rather than something that
/// happens to every row an operator clicks while browsing.
///
/// See OutboxEmailBodyResponse.
/// </remarks>
public class OutboxEmailDetailResponse
{
    public required OutboxEmailSummaryResponse Email { get; set; }

    public static OutboxEmailDetailResponse Create(OutboxEmailSummaryResponse email) => new()
    {
        Email = email,
    };
}
