// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailTemplate;

/// <summary>One editable piece of mail copy, plus everything needed to explain it.</summary>
public class MailTemplateResponse
{
    public required string Identifier { get; set; }

    /// <summary>Read-only: the key the calling code passes to the outbox.</summary>
    public required string Key { get; set; }

    /// <summary>Read-only: ISO 639-1.</summary>
    public required string Language { get; set; }

    public required string Subject { get; set; }

    public required string BodyHtml { get; set; }

    public required string BodyText { get; set; }

    public string? Description { get; set; }

    public DateTime LastUpdatedAt { get; set; }

    /// <summary>
    /// What this mail is for and when it is sent, from the catalogue rather than the
    /// database -- so it cannot be edited into something untrue. Null when no C# caller
    /// declares this key, which is itself worth showing.
    /// </summary>
    public string? Purpose { get; set; }

    /// <summary>
    /// Whether any C# caller declares this key. This is NOT the same question as whether
    /// <see cref="Tokens"/> is empty: an undeclared key has no token list because we do not
    /// know what its caller passes, and nothing in it may honestly be called unknown. A
    /// declared key with no tokens would mean the opposite -- that it takes none, so any
    /// placeholder in it really is a mistake.
    /// </summary>
    public bool IsKnown { get; set; }

    /// <summary>Every placeholder the caller supplies for this key.</summary>
    public required IReadOnlyCollection<MailTemplateTokenResponse> Tokens { get; set; }

    /// <summary>
    /// Placeholders the copy uses that the caller does NOT supply. Any of these stops the
    /// mail completely: the render fails and the enqueue fails with it. Saving is refused
    /// while this is non-empty.
    /// </summary>
    public required IReadOnlyCollection<string> UnknownTokens { get; set; }

    /// <summary>
    /// Placeholders the caller supplies that the copy does not use. Harmless to the render
    /// -- an unused model key is ignored -- but it is how a verification mail ends up with
    /// no link in it, so it is a warning rather than silence.
    /// </summary>
    public required IReadOnlyCollection<string> MissingTokens { get; set; }
}
