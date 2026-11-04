// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    private ActionResult ToNoContent(Result result)
    {
        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}
