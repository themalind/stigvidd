// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.ResponseModels.Admin;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/dashboard")]
[Authorize(Policy = "AdminOnly")]
public class AdminDashboardController : StigViddController
{
    private readonly IAdminDashboardService _dashboardService;

    public AdminDashboardController(IAdminDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet]
    public async Task<ActionResult<AdminDashboardResponse>> GetDashboard(CancellationToken ctoken)
    {
        var result = await _dashboardService.GetDashboardAsync(ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }
}
