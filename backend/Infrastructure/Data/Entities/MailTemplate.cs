// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// One piece of mail copy, in one language. Lives in the database rather than in the assembly
// so wording can be corrected without a deploy; (Key, Language) is unique.
public class MailTemplate : BaseEntity
{
    // Stable identifier the calling code passes, e.g. "welcome". Never shown to a recipient.
    public required string Key { get; set; }

    // ISO 639-1, e.g. "sv". MailOutbox:DefaultLanguage is used when a caller does not say.
    public required string Language { get; set; }

    public required string Subject { get; set; }

    public required string BodyHtml { get; set; }

    // Not optional: every mail goes out as multipart/alternative. A recipient reading plain
    // text gets this, and its presence is also what keeps the mail out of a spam folder.
    public required string BodyText { get; set; }

    // What the template is for and which placeholders it expects, for whoever edits it next.
    public string? Description { get; set; }
}
