// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories.Municipalities;

public interface IMunicipalityRepository
{
    Task<RepositoryResult<IReadOnlyCollection<Municipality>>> GetAllAsync(CancellationToken ctoken);
    Task<RepositoryResult<Municipality>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    // keep-comment: Conflict when the name or the slug is taken
    Task<RepositoryResult<Municipality>> CreateAsync(Municipality municipality, CancellationToken ctoken);
}
