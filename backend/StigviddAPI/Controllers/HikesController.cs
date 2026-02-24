using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Hike;
using WebDataContracts.ResponseModels.Hike;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class HikesController : StigViddController
{
    private readonly IHikeService _hikeService;
    private readonly IUserService _userService;

    public HikesController(IHikeService hikeService, IUserService userService)
    {
        _hikeService = hikeService;
        _userService = userService;
    }

    [HttpGet("{hikeIdentifier}")]
    public async Task<ActionResult<HikeResponse>> GetHikeByIdentifierAsync(
        string hikeIdentifier,
        CancellationToken ctoken
    )
    {
        var result = await _hikeService.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<HikeOverviewResponse>>> GetHikesAsync(
        [FromQuery] string? createdBy,
        CancellationToken ctoken)
    {
        var result = await _hikeService.GetHikesAsync(createdBy, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<HikeResponse>> CreateHikeAsync(
        [FromBody] CreateHikeRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _hikeService.CreateHikeAsync(request, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Created($"/api/v1/hikes/{result.Value!.Identifier}", result.Value);
    }

    [Authorize]
    [HttpDelete("{hikeIdentifier}")]
    public async Task<ActionResult> DeleteHikeAsync(
        string hikeIdentifier,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _hikeService.DeleteHikeAsync(hikeIdentifier, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}