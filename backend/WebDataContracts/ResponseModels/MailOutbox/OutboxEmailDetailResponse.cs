// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailOutbox;

/// <summary>
/// One mail with the bodies that were rendered for it at enqueue time.
/// </summary>
/// <remarks>
/// The bodies live here and not on the summary so a list page never carries them. BodyHtml is
/// operator-authored markup: values were HTML-encoded when it was rendered, so a nickname
/// cannot inject, but the surrounding markup came from a template row that can also have been
/// written straight into Postgres by hand. It belongs in a sandboxed iframe, not in an
/// innerHTML sink.
/// </remarks>
public class OutboxEmailDetailResponse
{
    public required OutboxEmailSummaryResponse Email { get; set; }
    public required string BodyHtml { get; set; }
    public required string BodyText { get; set; }

    public static OutboxEmailDetailResponse Create(
        OutboxEmailSummaryResponse email, string bodyHtml, string bodyText) => new()
        {
            Email = email,
            BodyHtml = bodyHtml,
            BodyText = bodyText,
        };
}
