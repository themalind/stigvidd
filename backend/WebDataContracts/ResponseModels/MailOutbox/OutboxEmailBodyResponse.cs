// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailOutbox;

/// <summary>
/// The rendered bodies of one mail, as they were produced at enqueue time.
/// </summary>
/// <remarks>
/// Served by its own route so that reading a body is an explicit request that can be logged
/// against the operator who made it. A row whose bodies have been cleared under the retention
/// rule has no body to serve and answers 404 — RedactedAt on the summary is what says so in
/// advance, so the UI can explain rather than ask and fail.
///
/// BodyHtml is operator-authored markup: values were HTML-encoded when it was rendered, so a
/// nickname cannot inject, but the surrounding markup came from a template row that can also
/// have been written straight into Postgres by hand. It belongs in a sandboxed iframe, not in
/// an innerHTML sink.
/// </remarks>
public class OutboxEmailBodyResponse
{
    public required string Identifier { get; set; }
    public required string BodyHtml { get; set; }
    public required string BodyText { get; set; }

    public static OutboxEmailBodyResponse Create(
        string identifier, string bodyHtml, string bodyText) => new()
        {
            Identifier = identifier,
            BodyHtml = bodyHtml,
            BodyText = bodyText,
        };
}
