// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StigviddAPI.Authorization;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/events")]
[Authorize]
public class EventParticipantsController : StigViddController
{
    private readonly IEventParticipationService _participationService;
    private readonly IUserService _userService;

    public EventParticipantsController(IEventParticipationService participationService, IUserService userService)
    {
        _participationService = participationService;
        _userService = userService;
    }

    [HttpPost]
    [Route("{identifier}/join")]
    public async Task<ActionResult> JoinEvent([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.JoinAsync(userResponse.Identifier, identifier, ctoken));
    }

    [HttpPost]
    [Route("{identifier}/interested")]
    public async Task<ActionResult> MarkInterested([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.MarkInterestedAsync(userResponse.Identifier, identifier, ctoken));
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("{identifier}/interested")]
    public async Task<ActionResult> UnmarkInterested([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.UnmarkInterestedAsync(userResponse.Identifier, identifier, ctoken));
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("{identifier}/leave")]
    public async Task<ActionResult> LeaveEvent([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.LeaveAsync(userResponse.Identifier, identifier, ctoken));
    }

    [HttpGet]
    [Route("{identifier}/participants")]
    public async Task<ActionResult<EventParticipantsResponse>> GetParticipants([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _participationService.GetParticipantsAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpDelete]
    [Route("{identifier}/participants/{participantIdentifier}")]
    public async Task<ActionResult> RemoveParticipant([FromRoute] string identifier, [FromRoute] string participantIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.RemoveParticipantAsync(userResponse.Identifier, identifier, participantIdentifier, ctoken));
    }

    [HttpPut]
    [Route("{identifier}/participants/{participantIdentifier}/role")]
    public async Task<ActionResult> SetParticipantRole(
        [FromRoute] string identifier,
        [FromRoute] string participantIdentifier,
        [FromBody] EventRoleRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.SetRoleAsync(userResponse.Identifier, identifier, participantIdentifier, request, ctoken));
    }

    [AllowWhenBanned]
    [HttpPut]
    [Route("{identifier}/mute")]
    public async Task<ActionResult> SetMuted([FromRoute] string identifier, [FromBody] EventMuteRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _participationService.SetMutedAsync(userResponse.Identifier, identifier, request, ctoken));
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
