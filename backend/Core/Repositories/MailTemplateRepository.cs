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
}
