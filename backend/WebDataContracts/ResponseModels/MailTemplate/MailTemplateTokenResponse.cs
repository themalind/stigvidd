// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.MailTemplate;

/// <summary>
/// One placeholder this template may use, described for whoever is editing it. The editor
/// shows <see cref="Label"/> rather than <see cref="Name"/>, because "Verification link"
/// means something to an operator and "VerificationUrl" does not.
/// </summary>
public class MailTemplateTokenResponse
{
    /// <summary>Written between double braces, e.g. "VerificationUrl".</summary>
    public required string Name { get; set; }

    public required string Label { get; set; }

    public required string Description { get; set; }

    /// <summary>What the preview substitutes. Never sent to anybody.</summary>
    public required string SampleValue { get; set; }

    /// <summary>
    /// Whether the saved copy uses it anywhere -- subject, HTML body or text body. False is
    /// not an error, but for a token like the verification link it means the mail is useless,
    /// so the editor says so.
    /// </summary>
    public bool IsUsed { get; set; }

    public static MailTemplateTokenResponse Create(
        string name, string label, string description, string sampleValue, bool isUsed) =>
        new()
        {
            Name = name,
            Label = label,
            Description = description,
            SampleValue = sampleValue,
            IsUsed = isUsed,
        };
}
