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
