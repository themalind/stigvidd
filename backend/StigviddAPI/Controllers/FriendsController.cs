// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Friend;
using WebDataContracts.ResponseModels.Friend;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class FriendsController : StigViddController
{
    private readonly IFriendService _friendService;
    private readonly IUserBlockService _userBlockService;
    private readonly IUserService _userService;

    public FriendsController(IFriendService friendService, IUserBlockService userBlockService, IUserService userService)
    {
        _friendService = friendService;
        _userBlockService = userBlockService;
        _userService = userService;
    }

    [HttpGet]
    [Route("blocks")]
    public async Task<ActionResult<IReadOnlyCollection<BlockedUserResponse>>> GetBlockedUsers(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userBlockService.GetBlockedUsersAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [AllowWhenBanned]
    [HttpPost]
    [Route("blocks/{identifier}")]
    public async Task<ActionResult> BlockUser([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userBlockService.BlockUserAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("blocks/{identifier}")]
    public async Task<ActionResult> UnblockUser([FromRoute] string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _userBlockService.UnblockUserAsync(userResponse.Identifier, identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [HttpGet]
    [Route("")]
    public async Task<ActionResult> GetFriends(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _friendService.GetFriendsAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("requests/incoming")]
    public async Task<ActionResult> GetIncomingFriendRequests(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _friendService.GetIncomingRequestsAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("requests/outgoing")]
    public async Task<ActionResult<IReadOnlyCollection<OutgoingFriendRequestResponse>>> GetOutgoingFriendRequests(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _friendService.GetOutgoingRequestsAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("requests")]
    public async Task<ActionResult> SendFriendRequest([FromBody] SendFriendRequestRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _friendService.SendFriendRequestAsync(userResponse.Identifier, request.ReceiverNickName, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result);
    }

    [HttpPut]
    [Route("requests/accept/{requesterIdentifier}")]
    public async Task<ActionResult> AcceptFriendRequest(string requesterIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }
        var result = await _friendService.AcceptFriendRequestAsync(userResponse.Identifier, requesterIdentifier, ctoken);
        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }
        return Ok(result);
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("reject/{otherIdentifier}")]
    public async Task<ActionResult> RemoveConnection(string otherIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }
        var result = await _friendService.RemoveConnectionAsync(userResponse.Identifier, otherIdentifier, ctoken);
        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }
        return Ok(result);
    }

    [AllowWhenBanned]
    [HttpDelete]
    [Route("{friendIdentifier}")]
    public async Task<ActionResult> RemoveFriend(string friendIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }
        var result = await _friendService.RemoveConnectionAsync(userResponse.Identifier, friendIdentifier, ctoken);
        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }
        return Ok(result);
    }
}