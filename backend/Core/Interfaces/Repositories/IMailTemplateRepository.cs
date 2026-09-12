// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IMailTemplateRepository
{
    Task<RepositoryResult<MailTemplate>> GetByKeyAsync(string key, string language, CancellationToken ctoken);

    // The three below serve the admin editor. Sending only ever needs GetByKeyAsync.
    Task<RepositoryResult<List<MailTemplate>>> GetAllAsync(CancellationToken ctoken);

    Task<RepositoryResult<MailTemplate>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);

    Task<RepositoryResult<MailTemplate>> UpdateAsync(
        string identifier,
        string subject,
        string bodyHtml,
        string bodyText,
        string? description,
        CancellationToken ctoken);
}
