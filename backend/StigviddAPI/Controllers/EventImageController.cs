// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.ResponseModels.Event;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/events")]
[Authorize]
public class EventImageController : StigViddController
{
    private readonly IEventImageService _imageService;
    private readonly IUserService _userService;

    public EventImageController(IEventImageService imageService, IUserService userService)
    {
        _imageService = imageService;
        _userService = userService;
    }

    [HttpPost]
    [Route("{identifier}/image")]
    public async Task<ActionResult<EventImageResponse>> SetImage([FromRoute] string identifier, IFormFile image, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _imageService.SetImageAsync(userResponse.Identifier, identifier, image, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [HttpDelete]
    [Route("{identifier}/image")]
    public async Task<ActionResult> DeleteImage([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _imageService.DeleteImageAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return NoContent();
    }
}
