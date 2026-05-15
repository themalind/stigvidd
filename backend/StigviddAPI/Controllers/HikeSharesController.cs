using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.HikeShare;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class HikeSharesController : StigViddController
{
    private readonly IHikeShareService _hikeShareService;
    private readonly IUserService _userService;

    public HikeSharesController(IHikeShareService hikeShareService, IUserService userService)
    {
        _hikeShareService = hikeShareService;
        _userService = userService;
    }

    [HttpGet]
    [Route("{hikeIdentifier}")]
    public async Task<ActionResult<int>> GetHikeSharedByUserCount([FromRoute] string hikeIdentifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareService.GetHikeShareCountAsync(userResponse.Identifier, hikeIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost]
    [Route("share")]
    public async Task<ActionResult> ShareHike([FromBody] HikeShareRequest hikeShareRequest, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeShareService.ShareHikeAsync(userResponse.Identifier, hikeShareRequest.HikeIdentifier, hikeShareRequest.SharedWithName, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok();
    }
}