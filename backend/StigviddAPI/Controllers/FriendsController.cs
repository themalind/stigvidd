using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Friend;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class FriendsController : StigViddController
{
    private readonly IFriendService _friendService;
    private readonly IUserService _userService;

    public FriendsController(IFriendService friendService, IUserService userService)
    {
        _friendService = friendService;
        _userService = userService;
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
    public async Task<ActionResult> GetOutgoingFriendRequests(CancellationToken ctoken)
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