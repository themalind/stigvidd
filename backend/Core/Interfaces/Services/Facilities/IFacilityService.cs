// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Http;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Interfaces.Services.Facilities;

public interface IFacilityService
{
    Task<Result<AdminFacilityResponse>> CreateFacilityAsync(SaveFacilityRequest request, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<FacilityResponse>>> GetAllAsync(CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<AdminFacilityResponse>>> GetAllIncludingUnmappedAsync(CancellationToken ctoken);
    Task<Result<FacilityResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<Result<AdminFacilityResponse>> UpdateFacilityAsync(string facilityIdentifier, SaveFacilityRequest request, CancellationToken ctoken);
    Task<Result> DeleteAsync(string facilityIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<FacilityImageResponse>>> AddFacilityImagesAsync(string facilityIdentifier, IFormFileCollection images, ImageProcessingOptions options, CancellationToken ctoken);
    Task<Result> DeleteFacilityImageAsync(string imageIdentifier, CancellationToken ctoken);
}
