// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.Municipality;

namespace Core.Interfaces.Services.Municipalities;

public interface IMunicipalityService
{
    Task<Result<IReadOnlyCollection<MunicipalityResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<MunicipalityResponse>> CreateAsync(CreateMunicipalityRequest request, CancellationToken ctoken);
}
