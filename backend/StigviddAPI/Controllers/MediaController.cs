using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Media;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class MediaController : StigViddController
{
    private readonly IMediaService _mediaService;
    private readonly IUserService _userService;

    public MediaController(IMediaService mediaService, IUserService userService)
    {
        _mediaService = mediaService;
        _userService = userService;
    }

    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<MediaItemResponse>>> GetAll(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _mediaService.GetAllMediaAsync(ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPatch("{imageIdentifier}")]
    public async Task<ActionResult> UpdateMetadata(
        string imageIdentifier,
        [FromBody] UpdateImageMetadataRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _mediaService.UpdateImageMetadataAsync(imageIdentifier, request.AltText, request.Caption, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return NoContent();
    }
}
