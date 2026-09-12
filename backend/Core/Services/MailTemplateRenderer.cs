// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using System.Net;
using System.Text.RegularExpressions;

namespace Core.Services;

// {{Placeholder}} substitution, and nothing more. A template needing a condition or a loop is
// a sign the decision belongs in C# at the call site, where it can be tested.
public partial class MailTemplateRenderer : IMailTemplateRenderer
{
    // Inner whitespace is tolerated so {{ NickName }} and {{NickName}} are the same
    // placeholder; the name itself stays boring so a typo cannot look like valid syntax.
    [GeneratedRegex(@"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex PlaceholderRegex();

    public Result<RenderedMail> Render(MailTemplate template, IReadOnlyDictionary<string, string?> model)
    {
        // Case-insensitive, so a caller writing "nickname" against {{NickName}} is not a
        // 3am incident.
        var lookup = new Dictionary<string, string?>(model, StringComparer.OrdinalIgnoreCase);

        var subject = Substitute(template.Subject, lookup, encodeHtml: false);
        if (subject.IsFailure)
            return Result.Fail<RenderedMail>(subject.Message!);

        // Values are HTML-encoded into the HTML body ONLY. A nickname containing < or & would
        // otherwise break the markup, and a value carrying a tag would be injection.
        var bodyHtml = Substitute(template.BodyHtml, lookup, encodeHtml: true);
        if (bodyHtml.IsFailure)
            return Result.Fail<RenderedMail>(bodyHtml.Message!);

        var bodyText = Substitute(template.BodyText, lookup, encodeHtml: false);
        if (bodyText.IsFailure)
            return Result.Fail<RenderedMail>(bodyText.Message!);

        // A newline in a subject is an SMTP header-injection vector: everything after it can
        // be read as a new header. Collapse rather than reject, since the value is usually a
        // legitimate name that happens to contain one.
        var safeSubject = subject.Value!.Replace("\r", " ").Replace("\n", " ").Trim();

        return Result.Ok(new RenderedMail(safeSubject, bodyHtml.Value!, bodyText.Value!));
    }

    public IReadOnlyCollection<string> ExtractPlaceholders(string template) =>
        PlaceholderRegex()
            .Matches(template)
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static Result<string> Substitute(
        string template, Dictionary<string, string?> model, bool encodeHtml)
    {
        string? missing = null;

        var rendered = PlaceholderRegex().Replace(template, match =>
        {
            var name = match.Groups[1].Value;

            // A placeholder with no model entry fails the whole render. Leaving it in place
            // would mail somebody the literal text "Hej {{NickName}}", and substituting an
            // empty string would hide the bug in a sentence that still reads almost right.
            if (!model.TryGetValue(name, out var value))
            {
                missing ??= name;
                return string.Empty;
            }

            // A key present but null renders empty. That is the caller saying "no value",
            // which is different from the caller forgetting the key exists.
            return encodeHtml ? WebUtility.HtmlEncode(value ?? string.Empty) : value ?? string.Empty;
        });

        if (missing is not null)
            return Result.Fail<string>(new Message(
                400, $"The mail template uses the placeholder '{{{{{missing}}}}}' but the model has no value for it."));

        return Result.Ok(rendered);
    }
}
