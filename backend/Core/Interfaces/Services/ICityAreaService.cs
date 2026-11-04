// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.CityArea;

namespace Core.Interfaces.Services;

public interface ICityAreaService
{
    Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<AdminCityAreaResponse>>> GetAllForAdminAsync(CancellationToken ctoken);
    Task<Result> SetFacilityLinkAsync(string areaIdentifier, string facilityIdentifier, bool linked, CancellationToken ctoken);
    Task<Result> SetTrailLinkAsync(string areaIdentifier, string trailIdentifier, bool linked, CancellationToken ctoken);
}
