// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.MailTemplate;

// An UNSAVED draft, rendered with the catalogue's sample values so an operator can see the
// real thing before committing to it. Nothing here is written anywhere.
public class PreviewMailTemplateRequest
{
    public required string Subject { get; set; }

    public required string BodyHtml { get; set; }

    public required string BodyText { get; set; }
}
