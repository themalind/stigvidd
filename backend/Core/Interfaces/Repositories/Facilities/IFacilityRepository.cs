// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Facilities;

public interface IFacilityRepository
{
    Task<RepositoryResult<Facility>> CreateFacilityAsync(Facility facility, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetAllAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetAllIncludingUnmappedAsync(CancellationToken ctoken);
    Task<RepositoryResult<Facility>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<Facility>> UpdateAsync(Facility facility, CancellationToken ctoken);
    Task<RepositoryResult> DeleteAsync(Facility facility, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<FacilityImage>>> AddFacilityImagesAsync(int facilityId, IReadOnlyCollection<FacilityImage> images, CancellationToken ctoken);
    Task<RepositoryResult> DeleteFacilityImageAsync(string imageIdentifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<Facility>>> GetImportCandidatesAsync(string sourceName, FacilityType facilityType, CancellationToken ctoken);
    // keep-comment: saves the source's mapping in the same transaction; Conflict when a facility or the source is gone
    Task<RepositoryResult> ApplyImportAsync(
        int sourceId, string mapping, IReadOnlyCollection<Facility> creates, IReadOnlyCollection<Facility> updates, CancellationToken ctoken);
}
