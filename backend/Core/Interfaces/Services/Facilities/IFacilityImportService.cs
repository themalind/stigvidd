// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Interfaces.Services.Facilities;

public interface IFacilityImportService
{
    Task<Result<FacilityImportPreviewResponse>> PreviewAsync(FacilityImportRequest request, CancellationToken ctoken);
    Task<Result<FacilityImportApplyResponse>> ApplyAsync(FacilityImportRequest request, CancellationToken ctoken);
}
