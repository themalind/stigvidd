// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using System.Text.RegularExpressions;

namespace Core.Services;

// What an operator is allowed to put in a mail body.
//
// This is a REJECTION GATE, not a sanitiser: it never rewrites the markup, it only reports
// what is not allowed and lets the caller refuse the save. That is deliberate. Silently
// stripping a tag would leave the operator looking at copy they did not write, discovering it
// only once a recipient did -- and MailTemplate.BodyHtml is emitted to inboxes verbatim, so
// the moment of the edit is the only moment anything is looking at it.
//
// It is regex tag extraction rather than a real parser, and it errs towards rejection: the
// tag list is an allowlist, so evasion means smuggling something past the scanner rather than
// finding a tag the list forgot. A false rejection is visible to the operator and fixable; a
// false accept is the one that matters. If this ever needs to be a real parser, Ganss.Xss is
// the upgrade path -- it was left out here to avoid a dependency and a licence review for a
// check this size.
public static partial class MailHtmlPolicy
{
    // Mail HTML, not web HTML: no script, no style element, no form, no iframe, and tables
    // because that is still how mail clients do layout.
    private static readonly HashSet<string> AllowedTags = new(StringComparer.OrdinalIgnoreCase)
    {
        "p", "br", "hr", "div", "span",
        "a", "img",
        "strong", "b", "em", "i", "u", "s", "small", "sub", "sup",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "blockquote", "pre", "code",
        "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
    };

    private static readonly HashSet<string> AllowedAttributes = new(StringComparer.OrdinalIgnoreCase)
    {
        "style", "class", "id", "title", "dir", "lang",
        "href", "target", "rel",
        "src", "alt", "width", "height",
        "align", "valign", "colspan", "rowspan",
        "border", "cellpadding", "cellspacing", "bgcolor",
    };

    // Attributes carrying a URL, which get the scheme check below.
    private static readonly HashSet<string> UrlAttributes = new(StringComparer.OrdinalIgnoreCase)
    {
        "href", "src",
    };

    // An allowlist rather than a "javascript:" denylist, because a denylist loses to
    // "&#106;avascript:" and "java\tscript:" and this one cannot.
    private static readonly string[] AllowedSchemes =
    [
        "http:", "https:", "mailto:", "tel:", "cid:",
    ];

    [GeneratedRegex(@"<!--.*?-->", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex CommentRegex();

    [GeneratedRegex(@"<\s*(/?)\s*([A-Za-z][A-Za-z0-9]*)((?:[^>""']|""[^""]*""|'[^']*')*)>", RegexOptions.CultureInvariant)]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"([A-Za-z_:][-A-Za-z0-9_:.]*)\s*(?:=\s*(""[^""]*""|'[^']*'|[^\s""'>]+))?", RegexOptions.CultureInvariant)]
    private static partial Regex AttributeRegex();

    /// <summary>
    /// Every reason this markup may not be saved, worded for the operator who wrote it.
    /// Empty means it is acceptable.
    /// </summary>
    public static IReadOnlyList<string> Check(string? html)
    {
        var violations = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        if (string.IsNullOrWhiteSpace(html))
            return violations;

        // Comments are allowed through (Outlook conditionals are a real thing), so their
        // contents must not then be scanned as markup.
        var scanned = CommentRegex().Replace(html, string.Empty);

        foreach (Match tag in TagRegex().Matches(scanned))
        {
            var isClosing = tag.Groups[1].Value == "/";
            var name = tag.Groups[2].Value;

            if (!AllowedTags.Contains(name))
            {
                Add(violations, seen, $"The tag <{name.ToLowerInvariant()}> is not allowed in a mail body.");
                continue;
            }

            // A closing tag carries nothing worth checking.
            if (isClosing)
                continue;

            CheckAttributes(name, tag.Groups[3].Value, violations, seen);
        }

        return violations;
    }

    private static void CheckAttributes(
        string tagName, string attributeText, List<string> violations, HashSet<string> seen)
    {
        if (string.IsNullOrWhiteSpace(attributeText))
            return;

        foreach (Match attribute in AttributeRegex().Matches(attributeText))
        {
            var name = attribute.Groups[1].Value;

            // Named separately from the allowlist because "an event handler" is a more useful
            // thing to be told than "that attribute is not on the list".
            if (name.StartsWith("on", StringComparison.OrdinalIgnoreCase))
            {
                Add(violations, seen, $"The event handler {name.ToLowerInvariant()}= is not allowed (on <{tagName.ToLowerInvariant()}>).");
                continue;
            }

            if (!AllowedAttributes.Contains(name))
            {
                Add(violations, seen, $"The attribute {name.ToLowerInvariant()}= is not allowed (on <{tagName.ToLowerInvariant()}>).");
                continue;
            }

            if (UrlAttributes.Contains(name))
                CheckUrl(tagName, name, Unquote(attribute.Groups[2].Value), violations, seen);
        }
    }

    private static void CheckUrl(
        string tagName, string attributeName, string value, List<string> violations, HashSet<string> seen)
    {
        // Decode first: "&#106;avascript:" and "java&#9;script:" are the same string to a
        // browser and must be the same string to this check.
        var decoded = WebUtility.HtmlDecode(value);

        // Control characters are ignored by URL parsers, so strip them rather than let one
        // break up a scheme we would otherwise recognise.
        var cleaned = new string([.. decoded.Where(c => !char.IsControl(c))]).Trim();

        if (cleaned.Length == 0)
            return;

        // Begins with a placeholder, e.g. "{{VerificationUrl}}" or "{{Base}}/verify": the
        // scheme arrives with the substituted value, and MailOutboxService renders before
        // anything is sent. A value that is ENTIRELY placeholders begins with one too, so
        // this covers that case as well -- cleaned has already been trimmed.
        if (cleaned.StartsWith("{{", StringComparison.Ordinal))
            return;

        if (AllowedSchemes.Any(scheme => cleaned.StartsWith(scheme, StringComparison.OrdinalIgnoreCase)))
            return;

        // A relative URL cannot resolve in a mail client, so it is a mistake rather than a
        // preference, and saying so is more use than allowing it.
        Add(violations, seen, $"The {attributeName.ToLowerInvariant()} on <{tagName.ToLowerInvariant()}> must be an absolute http(s), mailto:, tel: or cid: URL, or a placeholder. Found: {Shorten(cleaned)}");
    }

    private static string Unquote(string raw) =>
        raw.Length >= 2 && (raw[0] == '"' || raw[0] == '\'') && raw[^1] == raw[0]
            ? raw[1..^1]
            : raw;

    private static string Shorten(string value) =>
        value.Length <= 60 ? value : value[..60] + "…";

    // The same mistake repeated forty times is one thing to fix, and a 40-line validation
    // message is one nobody reads -- so violations are deduplicated and capped. The cap also
    // bounds the work: without it a body of distinct disallowed tags yields one message per
    // tag, and a List.Contains scan for each of those is quadratic in a value an operator
    // pasted.
    private const int MaxViolations = 20;

    private static void Add(List<string> violations, HashSet<string> seen, string violation)
    {
        if (violations.Count < MaxViolations && seen.Add(violation))
            violations.Add(violation);
    }
}
