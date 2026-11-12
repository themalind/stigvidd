// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Municipality;
using WebDataContracts.ResponseModels.Municipality;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/municipalities")]
[Authorize(Policy = "AdminOnly")]
public class AdminMunicipalitiesController : StigViddController
{
    private readonly IMunicipalityService _municipalityService;

    public AdminMunicipalitiesController(IMunicipalityService municipalityService)
    {
        _municipalityService = municipalityService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<MunicipalityResponse>>> GetAll(CancellationToken ctoken)
    {
        var result = await _municipalityService.GetAllAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    public async Task<ActionResult<MunicipalityResponse>> Create(
        [FromBody] CreateMunicipalityRequest request, CancellationToken ctoken)
    {
        var result = await _municipalityService.CreateAsync(request, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }
}
