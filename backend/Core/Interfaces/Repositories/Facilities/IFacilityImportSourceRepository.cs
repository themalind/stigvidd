// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories.Facilities;

public interface IFacilityImportSourceRepository
{
    Task<RepositoryResult<IReadOnlyCollection<FacilityImportSource>>> GetAllAsync(CancellationToken ctoken);
    Task<RepositoryResult<FacilityImportSource>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    // keep-comment: Conflict when the municipality already has the name or the key is taken
    Task<RepositoryResult<FacilityImportSource>> CreateAsync(FacilityImportSource source, CancellationToken ctoken);
}
