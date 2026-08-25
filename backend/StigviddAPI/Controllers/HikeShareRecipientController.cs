using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.HikeShare;
using WebDataContracts.ResponseModels.HikeShare;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class HikeShareRecipientController : StigViddController
{
    private readonly IHikeShareRecipientService _hikeShareRecipientService;
    private readonly IUserService _userService;

    public HikeShareRecipientController(IHikeShareRecipientService hikeShareRecipientService, IUserService userService)
    {
        _hikeShareRecipientService = hikeShareRecipientService;
        _userService = userService;
    }

    [HttpGet]
    [Route("")]
    public async Task<ActionResult<IReadOnlyCollection<HikeShareRecipientResponse>>> GetHikesSharedWithUser(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.GetAllHikesSharedWithUserAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("incoming/{hikeIdentifier}")]
    public async Task<ActionResult<HikeShareRecipientResponse>> GetIncomingPendingShare([FromRoute] string hikeIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.GetIncomingPendingShareAsync(userResponse.Identifier, hikeIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("incoming")]
    public async Task<ActionResult<IReadOnlyCollection<HikeShareRecipientResponse>>> GetPendingShares(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.GetIncomingPendingSharesAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPut]
    [Route("accept/{hikeIdentifier}")]
    public async Task<ActionResult> AcceptSharedHike([FromRoute] string hikeIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.AcceptHikeShareAsync(userResponse.Identifier, hikeIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok();
    }

    [HttpPost]
    [Route("re-share")]
    public async Task<ActionResult> ReshareSharedHike([FromBody] ReshareSharedHikeRequest request, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.ReshareSharedHikeAsync(request.HikeIdentifier, userResponse.Identifier, request.ReShareToName, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok();
    }

    [HttpDelete]
    [Route("reject/{hikeIdentifier}")]
    public async Task<ActionResult> RejectSharedHike([FromRoute] string hikeIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.RejectHikeShareAsync(userResponse.Identifier, hikeIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok();
    }

    [HttpDelete]
    [Route("{hikeIdentifier}")]
    public async Task<ActionResult> RemoveSharedHike([FromRoute] string hikeIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareRecipientService.RemoveSharedHikeAsync(hikeIdentifier, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }
        return Ok();
    }
}
