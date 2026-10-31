// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class EventsController : StigViddController
{
    private readonly IEventService _eventService;
    private readonly IUserService _userService;

    public EventsController(IEventService eventService, IUserService userService)
    {
        _eventService = eventService;
        _userService = userService;
    }

    [HttpPost]
    public async Task<ActionResult<EventResponse>> CreateEvent([FromBody] CreateEventRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.CreateAsync(userResponse.Identifier, request, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return CreatedAtAction(nameof(GetEvent), new { identifier = result.Value.Identifier }, result.Value);
    }

    [HttpGet]
    public async Task<ActionResult<EventPageResponse>> GetEvents([FromQuery] EventFeedQuery query, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.GetFeedAsync(userResponse.Identifier, query, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("mine")]
    public async Task<ActionResult<EventPageResponse>> GetMyEvents([FromQuery] MyEventsQuery query, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.GetMineAsync(userResponse.Identifier, query, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("{identifier}")]
    public async Task<ActionResult<EventResponse>> GetEvent([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.GetAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpPut]
    [Route("{identifier}")]
    public async Task<ActionResult<EventResponse>> UpdateEvent([FromRoute] string identifier, [FromBody] UpdateEventRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.UpdateAsync(userResponse.Identifier, identifier, request, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("{identifier}/cancel")]
    public async Task<ActionResult> CancelEvent([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.CancelAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return NoContent();
    }

    [HttpDelete]
    [Route("{identifier}")]
    public async Task<ActionResult> DeleteEvent([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _eventService.DeleteAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return NoContent();
    }
}
