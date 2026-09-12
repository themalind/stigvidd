// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class MailTemplateRepository : IMailTemplateRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<MailTemplateRepository> _logger;

    public MailTemplateRepository(
        IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<MailTemplateRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<MailTemplate>> GetByKeyAsync(
        string key, string language, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var template = await context.MailTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Key == key && t.Language == language, ctoken);

            return template is null
                ? RepositoryResult<MailTemplate>.NotFound()
                : RepositoryResult<MailTemplate>.Success(template);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailTemplateRepository: GetByKeyAsync -> Something went wrong when fetching template {key}/{language}.", key, language);
            return RepositoryResult<MailTemplate>.Error();
        }
    }

    public async Task<RepositoryResult<List<MailTemplate>>> GetAllAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Key then Language, so the languages of one template stay together in the list
            // the operator reads.
            var templates = await context.MailTemplates
                .AsNoTracking()
                .OrderBy(t => t.Key)
                .ThenBy(t => t.Language)
                .ToListAsync(ctoken);

            return RepositoryResult<List<MailTemplate>>.Success(templates);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailTemplateRepository: GetAllAsync -> Something went wrong when listing templates.");
            return RepositoryResult<List<MailTemplate>>.Error();
        }
    }

    public async Task<RepositoryResult<MailTemplate>> GetByIdentifierAsync(
        string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var template = await context.MailTemplates
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

            return template is null
                ? RepositoryResult<MailTemplate>.NotFound()
                : RepositoryResult<MailTemplate>.Success(template);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailTemplateRepository: GetByIdentifierAsync -> Something went wrong when fetching template {identifier}.", identifier);
            return RepositoryResult<MailTemplate>.Error();
        }
    }

    public async Task<RepositoryResult<MailTemplate>> UpdateAsync(
        string identifier,
        string subject,
        string bodyHtml,
        string bodyText,
        string? description,
        CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Deliberately NOT AsNoTracking, unlike every read above: an untracked entity is
            // not in the change tracker, so SaveChangesAsync would write nothing and report
            // success.
            var template = await context.MailTemplates
                .FirstOrDefaultAsync(t => t.Identifier == identifier, ctoken);

            if (template is null)
                return RepositoryResult<MailTemplate>.NotFound();

            // Key and Language are not editable. They are what the calling C# passes to
            // EnqueueAsync, so changing either orphans the call site and the mail stops.
            template.Subject = subject;
            template.BodyHtml = bodyHtml;
            template.BodyText = bodyText;
            template.Description = description;
            template.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<MailTemplate>.Success(template);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailTemplateRepository: UpdateAsync -> Something went wrong when updating template {identifier}.", identifier);
            return RepositoryResult<MailTemplate>.Error();
        }
    }
}
