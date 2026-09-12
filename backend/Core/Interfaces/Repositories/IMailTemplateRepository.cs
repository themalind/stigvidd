// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IMailTemplateRepository
{
    Task<RepositoryResult<MailTemplate>> GetByKeyAsync(string key, string language, CancellationToken ctoken);
}
