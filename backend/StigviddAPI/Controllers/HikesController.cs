using Core.Interfaces.Services;
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

    [Authorize]
    [HttpGet("{hikeIdentifier}")]
    public async Task<ActionResult<HikeResponse>> GetHikeByIdentifier(
        string hikeIdentifier,
        CancellationToken ctoken
    )
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _hikeService.GetHikeByIdentifierAsync(hikeIdentifier, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<HikeResponse>>> GetHikes(
        [FromQuery] string? createdBy,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        // Hikes are private: a caller may only list their own. The client-supplied
        // createdBy is never trusted for filtering — it may only self-select. Shared
        // hikes are read through HikeShareRecipientController, not here.
        if (createdBy is not null && createdBy != userResponse.Identifier)
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        var result = await _hikeService.GetHikesAsync(userResponse.Identifier, ctoken);

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<HikeResponse>> CreateHike(
        [FromBody] CreateHikeRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeService.CreateHikeAsync(request, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        if (result.Value is null)
            return StatusCode(500);

        return Created($"/api/v1/hikes/{result.Value.Identifier}", result.Value);
    }

    [Authorize]
    [HttpPut]
    [Route("{hikeIdentifier}")]
    public async Task<ActionResult<HikeResponse>> UpdateHike(
        [FromRoute] string hikeIdentifier,
        [FromBody] UpdateHikeRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);
        if (userResponse == null)
        {
            return Unauthorized();
        }

        var result = await _hikeService.UpdateHikeAsync(
            hikeIdentifier,
            userResponse.Identifier,
            request.Name,
            request.Description,
            request.GettingThere,
            request.ParkingInfo, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpDelete]
    [Route("{hikeIdentifier}")]
    public async Task<ActionResult> DeleteHike(
        string hikeIdentifier,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _hikeService.SoftDeleteHikeAsync(hikeIdentifier, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}