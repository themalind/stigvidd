// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.MailTemplate;

// Key and Language are deliberately absent: they identify which calling code sends this
// template, so they are not the operator's to change.
public class UpdateMailTemplateRequest
{
    public required string Subject { get; set; }

    public required string BodyHtml { get; set; }

    /// <summary>
    /// The plain-text alternative. Not optional -- every mail goes out as
    /// multipart/alternative, and a mail with no text part reads as empty in a plain-text
    /// client and scores as spam everywhere else.
    /// </summary>
    public required string BodyText { get; set; }

    public string? Description { get; set; }
}
