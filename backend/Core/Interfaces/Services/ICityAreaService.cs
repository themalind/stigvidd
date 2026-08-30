// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.CityArea;

namespace Core.Interfaces.Services;

public interface ICityAreaService
{
    Task<Result<IReadOnlyCollection<CityAreaResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<CityAreaResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
}
