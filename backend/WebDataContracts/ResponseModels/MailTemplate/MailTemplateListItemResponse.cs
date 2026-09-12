// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailTemplate;

/// <summary>
/// A row in the template list. Carries the counts rather than the bodies, so the list can
/// flag a template that needs attention without shipping every mail body to render it.
/// </summary>
public class MailTemplateListItemResponse
{
    public required string Identifier { get; set; }

    public required string Key { get; set; }

    public required string Language { get; set; }

    public required string Subject { get; set; }

    public string? Description { get; set; }

    public DateTime LastUpdatedAt { get; set; }

    /// <summary>
    /// Whether any C# caller declares this key. False means the row is orphaned -- nothing
    /// sends it -- which is worth showing rather than hiding.
    /// </summary>
    public bool IsKnown { get; set; }

    /// <summary>Placeholders used that the caller does not supply. Any at all stops the mail.</summary>
    public int UnknownTokenCount { get; set; }

    /// <summary>Placeholders supplied but unused. Renders fine; may mean a useless mail.</summary>
    public int MissingTokenCount { get; set; }

    public static MailTemplateListItemResponse Create(
        string identifier,
        string key,
        string language,
        string subject,
        string? description,
        DateTime lastUpdatedAt,
        bool isKnown,
        int unknownTokenCount,
        int missingTokenCount) =>
        new()
        {
            Identifier = identifier,
            Key = key,
            Language = language,
            Subject = subject,
            Description = description,
            LastUpdatedAt = lastUpdatedAt,
            IsKnown = isKnown,
            UnknownTokenCount = unknownTokenCount,
            MissingTokenCount = missingTokenCount,
        };
}
