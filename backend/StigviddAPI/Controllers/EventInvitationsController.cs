// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StigviddAPI.Authorization;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace StigviddAPI.Controllers;

// The literal "invitations" segment outranks {identifier} in routing, so these never reach EventsController. keep-comment: pinned by an integration test
[ApiController]
[Route("api/v1/events")]
[Authorize]
public class EventInvitationsController : StigViddController
{
    private readonly IEventInvitationService _invitationService;
    private readonly IUserService _userService;

    public EventInvitationsController(IEventInvitationService invitationService, IUserService userService)
    {
        _invitationService = invitationService;
        _userService = userService;
    }

    [HttpPost]
    [Route("{identifier}/invite")]
    public async Task<ActionResult> Invite([FromRoute] string identifier, [FromBody] EventInviteRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _invitationService.InviteAsync(userResponse.Identifier, identifier, request, ctoken));
    }

    [HttpGet]
    [Route("invitations")]
    public async Task<ActionResult<IReadOnlyList<EventInvitationResponse>>> GetInvitations(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _invitationService.GetPendingAsync(userResponse.Identifier, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("invitations/{identifier}/accept")]
    public async Task<ActionResult> AcceptInvitation([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _invitationService.AcceptAsync(userResponse.Identifier, identifier, ctoken));
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("invitations/{identifier}")]
    public async Task<ActionResult> DeclineInvitation([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _invitationService.DeclineAsync(userResponse.Identifier, identifier, ctoken));
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("{identifier}/invitations/{inviteeIdentifier}")]
    public async Task<ActionResult> RevokeInvitation([FromRoute] string identifier, [FromRoute] string inviteeIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _invitationService.RevokeAsync(userResponse.Identifier, identifier, inviteeIdentifier, ctoken));
    }

    private ActionResult NoContentOr(Result result)
    {
        if (!result.Success)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return NoContent();
    }
}
