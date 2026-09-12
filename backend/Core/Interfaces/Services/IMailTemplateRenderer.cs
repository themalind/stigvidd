// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Services;

// Substitutes {{Placeholder}} values into a template. Deliberately not a general-purpose
// engine: no conditionals, no loops, no partials.
public interface IMailTemplateRenderer
{
    // Renders subject, HTML body and text body together, because the HTML encoding rule
    // differs per part and must be decided in exactly one place.
    Result<RenderedMail> Render(MailTemplate template, IReadOnlyDictionary<string, string?> model);

    // Every distinct placeholder name in a template, for tests and for whoever is writing one.
    IReadOnlyCollection<string> ExtractPlaceholders(string template);
}

public record RenderedMail(string Subject, string BodyHtml, string BodyText);
