// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/facilities/import")]
[Authorize(Policy = "AdminOnly")]
public class AdminFacilityImportController : StigViddController
{
    private readonly IFacilityImportService _facilityImportService;

    public AdminFacilityImportController(IFacilityImportService facilityImportService)
    {
        _facilityImportService = facilityImportService;
    }

    [HttpPost("preview")]
    public async Task<ActionResult<FacilityImportPreviewResponse>> Preview(
        [FromBody] FacilityImportRequest request, CancellationToken ctoken)
    {
        var result = await _facilityImportService.PreviewAsync(request, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    public async Task<ActionResult<FacilityImportApplyResponse>> Apply(
        [FromBody] FacilityImportRequest request, CancellationToken ctoken)
    {
        var result = await _facilityImportService.ApplyAsync(request, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }
}
