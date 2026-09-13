// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Facility;

namespace StigviddAPI.Controllers.Admin;

/// <summary>
/// Facility management for the admin dashboard. Admin-only.
/// The anonymous read endpoints live in <see cref="FacilitiesController"/>.
/// </summary>
[ApiController]
[Route("api/v1/admin/facilities")]
[Authorize(Policy = "AdminOnly")]
public class AdminFacilitiesController : StigViddController
{
    private readonly IFacilityService _facilityService;

    public AdminFacilitiesController(IFacilityService facilityService)
    {
        _facilityService = facilityService;
    }

    [HttpPost]
    public async Task<ActionResult<FacilityResponse>> Create([FromBody] CreateFacilityRequest request, CancellationToken ctoken)
    {
        var result = await _facilityService.CreateFacilityAsync(request.Name, request.FacilityType, request.IsAccessible, request.Longitude, request.Latitude, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPut("{identifier}")]
    public async Task<ActionResult<FacilityResponse>> Update(
        [FromRoute] string identifier,
        [FromBody] UpdateFacilityRequest request, CancellationToken ctoken)
    {
        var result = await _facilityService.UpdateFacilityAsync(identifier, request.Name, request.FacilityType, request.IsAccessible, request.Longitude, request.Latitude, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpDelete("{identifier}")]
    public async Task<ActionResult> Delete(string identifier, CancellationToken ctoken)
    {
        var result = await _facilityService.DeleteAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [HttpPost("{identifier}/images")]
    public async Task<ActionResult<IReadOnlyCollection<FacilityImageResponse>>> AddFacilityImages(
        string identifier,
        [FromForm] IFormFileCollection images,
        [FromForm] ImageProcessingOptionsRequest options,
        CancellationToken ctoken)
    {
        var result = await _facilityService.AddFacilityImagesAsync(identifier, images, options.ToOptions(), ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpDelete("images/{imageIdentifier}")]
    public async Task<ActionResult> DeleteFacilityImage(string imageIdentifier, CancellationToken ctoken)
    {
        var result = await _facilityService.DeleteFacilityImageAsync(imageIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}
