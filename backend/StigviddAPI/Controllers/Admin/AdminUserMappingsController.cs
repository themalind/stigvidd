// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.UserMapping;
using WebDataContracts.ResponseModels.UserMapping;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminUserMappingsController : StigViddController
{
    private readonly IUserKeycloakMappingService _mappings;

    public AdminUserMappingsController(IUserKeycloakMappingService mappings)
    {
        _mappings = mappings;
    }

    [HttpGet("user-mappings")]
    public async Task<ActionResult<UserMappingsResponse>> GetMappings(CancellationToken ctoken)
    {
        var result = await _mappings.GetAsync(ctoken);

        return result.IsFailure && result.Message is not null ? ToActionResult(result.Message) : Ok(result.Value);
    }

    [HttpPut("user-mappings/{packageUserId:int}")]
    public async Task<ActionResult> SaveMapping(
        [FromRoute] int packageUserId,
        [FromBody] SaveUserMappingRequest request,
        CancellationToken ctoken)
    {
        var result = await _mappings.SaveAsync(packageUserId, request, ctoken);

        return result.IsFailure && result.Message is not null ? ToActionResult(result.Message) : NoContent();
    }

    [HttpDelete("user-mappings/{packageUserId:int}")]
    public async Task<ActionResult> DeleteMapping([FromRoute] int packageUserId, CancellationToken ctoken)
    {
        var result = await _mappings.DeleteAsync(packageUserId, ctoken);

        return result.IsFailure && result.Message is not null ? ToActionResult(result.Message) : NoContent();
    }

    [HttpGet("keycloak-users")]
    public async Task<ActionResult<IReadOnlyList<KeycloakUserResponse>>> SearchKeycloakUsers(
        [FromQuery] string? search,
        CancellationToken ctoken)
    {
        var result = await _mappings.SearchKeycloakUsersAsync(search, ctoken);

        return result.IsFailure && result.Message is not null ? ToActionResult(result.Message) : Ok(result.Value);
    }
}
