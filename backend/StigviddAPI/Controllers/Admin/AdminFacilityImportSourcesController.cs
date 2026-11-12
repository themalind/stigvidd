// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/facilities/import/sources")]
[Authorize(Policy = "AdminOnly")]
public class AdminFacilityImportSourcesController : StigViddController
{
    private readonly IFacilityImportSourceService _sourceService;

    public AdminFacilityImportSourcesController(IFacilityImportSourceService sourceService)
    {
        _sourceService = sourceService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<FacilityImportSourceResponse>>> GetAll(CancellationToken ctoken)
    {
        var result = await _sourceService.GetAllAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    public async Task<ActionResult<FacilityImportSourceResponse>> Create(
        [FromBody] CreateFacilityImportSourceRequest request, CancellationToken ctoken)
    {
        var result = await _sourceService.CreateAsync(request, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }
}
