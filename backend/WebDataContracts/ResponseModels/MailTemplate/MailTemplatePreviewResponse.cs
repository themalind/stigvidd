// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailTemplate;

/// <summary>
/// A draft put through the real renderer with the catalogue's sample values. This is the
/// same code path a sent mail takes, so a draft that previews is a draft that will render.
/// </summary>
public class MailTemplatePreviewResponse
{
    public required string Subject { get; set; }

    public required string BodyHtml { get; set; }

    public required string BodyText { get; set; }

    public static MailTemplatePreviewResponse Create(string subject, string bodyHtml, string bodyText) =>
        new() { Subject = subject, BodyHtml = bodyHtml, BodyText = bodyText };
}
