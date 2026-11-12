// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.CityArea;
using WebDataContracts.ResponseModels.CityArea;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/city-areas")]
[Authorize(Policy = "AdminOnly")]
public class AdminCityAreasController : StigViddController
{
    private readonly ICityAreaService _cityAreaService;

    public AdminCityAreasController(ICityAreaService cityAreaService)
    {
        _cityAreaService = cityAreaService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<AdminCityAreaResponse>>> GetAll(CancellationToken ctoken)
    {
        var result = await _cityAreaService.GetAllForAdminAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("suggestions")]
    public async Task<ActionResult<AdminLinkSuggestionsResponse>> GetLinkSuggestions(CancellationToken ctoken)
    {
        var result = await _cityAreaService.GetLinkSuggestionsAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPut("{identifier}/facilities/{facilityIdentifier}")]
    public async Task<ActionResult> LinkFacility(string identifier, string facilityIdentifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.SetFacilityLinkAsync(identifier, facilityIdentifier, true, ctoken));
    }

    [HttpDelete("{identifier}/facilities/{facilityIdentifier}")]
    public async Task<ActionResult> UnlinkFacility(string identifier, string facilityIdentifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.SetFacilityLinkAsync(identifier, facilityIdentifier, false, ctoken));
    }

    [HttpPut("{identifier}/trails/{trailIdentifier}")]
    public async Task<ActionResult> LinkTrail(string identifier, string trailIdentifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.SetTrailLinkAsync(identifier, trailIdentifier, true, ctoken));
    }

    [HttpDelete("{identifier}/trails/{trailIdentifier}")]
    public async Task<ActionResult> UnlinkTrail(string identifier, string trailIdentifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.SetTrailLinkAsync(identifier, trailIdentifier, false, ctoken));
    }

    [HttpDelete("{identifier}/excluded-facilities/{facilityIdentifier}")]
    public async Task<ActionResult> RemoveFacilityExclusion(string identifier, string facilityIdentifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.RemoveFacilityExclusionAsync(identifier, facilityIdentifier, ctoken));
    }

    [HttpDelete("{identifier}/excluded-trails/{trailIdentifier}")]
    public async Task<ActionResult> RemoveTrailExclusion(string identifier, string trailIdentifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.RemoveTrailExclusionAsync(identifier, trailIdentifier, ctoken));
    }

    [HttpPut("{identifier}/boundary")]
    public async Task<ActionResult> SaveBoundary(string identifier, [FromBody] SaveCityAreaBoundaryRequest request, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.SaveBoundaryAsync(identifier, request, ctoken));
    }

    [HttpPost("{identifier}/boundary-preview")]
    public async Task<ActionResult<AdminCityAreaBoundaryPreviewResponse>> PreviewBoundary(
        string identifier, [FromBody] SaveCityAreaBoundaryRequest request, CancellationToken ctoken)
    {
        var result = await _cityAreaService.PreviewBoundaryAsync(identifier, request, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("{identifier}/trail-paths")]
    public async Task<ActionResult<IReadOnlyCollection<AdminCityAreaTrailPathResponse>>> GetTrailPaths(string identifier, CancellationToken ctoken)
    {
        var result = await _cityAreaService.GetTrailPathsAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("{identifier}/boundary-suggestion")]
    public async Task<ActionResult<AdminCityAreaBoundaryResponse>> SuggestBoundary(string identifier, CancellationToken ctoken)
    {
        var result = await _cityAreaService.SuggestBoundaryAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpDelete("{identifier}/boundary")]
    public async Task<ActionResult> RemoveBoundary(string identifier, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.RemoveBoundaryAsync(identifier, ctoken));
    }

    [HttpPut("{identifier}/municipality")]
    public async Task<ActionResult> SetMunicipality(string identifier, [FromBody] SetCityAreaMunicipalityRequest request, CancellationToken ctoken)
    {
        return ToNoContent(await _cityAreaService.SetMunicipalityAsync(identifier, request, ctoken));
    }

    [HttpPost("recalculate")]
    public async Task<ActionResult<AdminCityAreaRecalculationResponse>> RecalculateAll(CancellationToken ctoken)
    {
        var result = await _cityAreaService.RecalculateAllAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    private ActionResult ToNoContent(Result result)
    {
        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}
