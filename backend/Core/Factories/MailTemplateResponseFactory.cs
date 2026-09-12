// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.MailTemplate;

namespace Core.Factories;

// Entity + catalogue -> the shape the editor needs. The catalogue half is what turns a row of
// text into something an operator can act on: what the mail is for, which placeholders it may
// use, and which of those it currently does.
public class MailTemplateResponseFactory
{
    private readonly IMailTemplateRenderer _renderer;

    public MailTemplateResponseFactory(IMailTemplateRenderer renderer)
    {
        _renderer = renderer;
    }

    public MailTemplateResponse Create(MailTemplate template, MailTemplateDefinition? definition)
    {
        var (used, declared, _) = Analyse(template, definition);

        return new MailTemplateResponse
        {
            Identifier = template.Identifier,
            Key = template.Key,
            Language = template.Language,
            Subject = template.Subject,
            BodyHtml = template.BodyHtml,
            BodyText = template.BodyText,
            Description = template.Description,
            LastUpdatedAt = template.LastUpdatedAt,
            Purpose = definition?.Purpose,
            IsKnown = definition is not null,
            Tokens = [.. declared.Select(token => MailTemplateTokenResponse.Create(
                token.Name,
                token.Label,
                token.Description,
                token.SampleValue,
                used.Contains(token.Name)))],

            UnknownTokens = [.. UnknownTokens(template, definition)],

            MissingTokens = [.. MissingTokens(template, definition)],
        };
    }

    public MailTemplateListItemResponse CreateListItem(MailTemplate template, MailTemplateDefinition? definition)
    {
        var (_, declared, _) = Analyse(template, definition);

        return MailTemplateListItemResponse.Create(
            template.Identifier,
            template.Key,
            template.Language,
            template.Subject,
            template.Description,
            template.LastUpdatedAt,
            definition is not null,
            UnknownTokens(template, definition).Count,
            MissingTokens(template, definition).Count);
    }

    /// <summary>
    /// Placeholders the copy uses that the caller does not supply. Every one of these stops
    /// the mail: the render fails and the enqueue fails with it.
    ///
    /// Public because MailTemplateAdminService refuses a save on the same answer, and one
    /// definition of it is the point -- if the two ever disagreed, the API would refuse a
    /// save that the response it returns calls fine.
    /// </summary>
    public IReadOnlyList<string> UnknownTokens(MailTemplate template, MailTemplateDefinition? definition)
    {
        // A key with no catalogue entry declares no tokens, so everything it uses would read
        // as unknown. That is misleading rather than useful -- we do not know what its caller
        // supplies -- so report nothing instead of condemning all of it.
        if (definition is null)
            return [];

        var (used, _, declaredNames) = Analyse(template, definition);

        return [.. used
            .Where(name => !declaredNames.Contains(name))
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)];
    }

    /// <summary>
    /// Placeholders the caller supplies that the copy does not use. Harmless to the render,
    /// and how a verification mail ends up with no link in it.
    /// </summary>
    public IReadOnlyList<string> MissingTokens(MailTemplate template, MailTemplateDefinition? definition)
    {
        var (used, declared, _) = Analyse(template, definition);

        return [.. declared.Where(token => !used.Contains(token.Name)).Select(token => token.Name)];
    }

    // Case-insensitive throughout, because that is how MailTemplateRenderer looks a
    // placeholder up -- {{nickname}} and {{NickName}} are one token to the renderer and must
    // be one token here too.
    private (HashSet<string> Used, IReadOnlyList<MailTemplateToken> Declared, HashSet<string> DeclaredNames)
        Analyse(MailTemplate template, MailTemplateDefinition? definition)
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var part in new[] { template.Subject, template.BodyHtml, template.BodyText })
        {
            foreach (var name in _renderer.ExtractPlaceholders(part))
                used.Add(name);
        }

        var declared = definition?.Tokens ?? [];

        return (
            used,
            declared,
            new HashSet<string>(declared.Select(token => token.Name), StringComparer.OrdinalIgnoreCase));
    }
}
