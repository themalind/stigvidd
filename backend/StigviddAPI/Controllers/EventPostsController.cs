// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StigviddAPI.Authorization;
using StigviddAPI.Extensions;
using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace StigviddAPI.Controllers;

// The literal "posts" segment outranks {identifier} in routing, so posts/{postIdentifier} never reaches an event route. keep-comment: pinned by an integration test
[ApiController]
[Route("api/v1/events")]
[Authorize]
public class EventPostsController : StigViddController
{
    private readonly IEventBoardService _boardService;
    private readonly IUserService _userService;

    public EventPostsController(IEventBoardService boardService, IUserService userService)
    {
        _boardService = boardService;
        _userService = userService;
    }

    [HttpGet]
    [Route("{identifier}/posts")]
    public async Task<ActionResult<EventBoardResponse>> GetPosts([FromRoute] string identifier, [FromQuery] EventBoardQuery query, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _boardService.GetBoardAsync(userResponse.Identifier, identifier, query, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("{identifier}/posts")]
    [EnableRateLimiting(RateLimitingExtensions.EventPosts)]
    public async Task<ActionResult<EventPostResponse>> CreatePost([FromRoute] string identifier, [FromBody] EventPostRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _boardService.CreatePostAsync(userResponse.Identifier, identifier, request, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return StatusCode(StatusCodes.Status201Created, result.Value);
    }

    [AllowWhenBanned]
    [HttpPut]
    [Route("{identifier}/posts/read")]
    public async Task<ActionResult> MarkPostsRead([FromRoute] string identifier, [FromBody] EventPostsReadRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _boardService.MarkReadAsync(userResponse.Identifier, identifier, request, ctoken));
    }

    [HttpPut]
    [Route("posts/{postIdentifier}")]
    public async Task<ActionResult<EventPostResponse>> UpdatePost([FromRoute] string postIdentifier, [FromBody] EventPostRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _boardService.UpdatePostAsync(userResponse.Identifier, postIdentifier, request, ctoken);

        if (!result.Success || result.Value is null)
        {
            return ToActionResult(result.Message ?? new Message(500));
        }

        return Ok(result.Value);
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("posts/{postIdentifier}")]
    public async Task<ActionResult> DeletePost([FromRoute] string postIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _boardService.DeletePostAsync(userResponse.Identifier, postIdentifier, ctoken));
    }

    [HttpPut]
    [Route("posts/{postIdentifier}/pin")]
    public async Task<ActionResult> SetPostPinned([FromRoute] string postIdentifier, [FromBody] EventPostPinRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        return NoContentOr(await _boardService.SetPinnedAsync(userResponse.Identifier, postIdentifier, request, ctoken));
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
