// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebDataContracts.RequestModels.User;

namespace StigviddAPI.Controllers.Admin;

/// <summary>
/// Banning an account: it keeps reading the app and stops being able to write to it. Barring
/// sign-in altogether is not this, and is not done from here.
/// </summary>
[ApiController]
[Route("api/v1/admin/users")]
[Authorize(Policy = "AdminOnly")]
public class AdminUsersController : StigViddController
{
    private readonly IAdminUserService _adminUserService;

    public AdminUsersController(IAdminUserService adminUserService)
    {
        _adminUserService = adminUserService;
    }

    [HttpPost("{identifier}/ban")]
    public async Task<ActionResult> BanUser(
        [FromRoute] string identifier,
        [FromBody] BanUserRequest request,
        CancellationToken ctoken)
    {
        var result = await _adminUserService.BanAsync(identifier, CurrentModerator(), request.Reason, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    [HttpDelete("{identifier}/ban")]
    public async Task<ActionResult> UnbanUser([FromRoute] string identifier, CancellationToken ctoken)
    {
        var result = await _adminUserService.UnbanAsync(identifier, CurrentModerator(), ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    // Identity.Name needs a "name" claim Keycloak only issues when the profile carries one.
    private string CurrentModerator() =>
        User.FindFirst("preferred_username")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? "unknown";
}
