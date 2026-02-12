using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TrailController : StigViddController
{
    private readonly ITrailService _trailService;
    private readonly IUserService _userService;
    private readonly ILogger<TrailController> _logger;

    public TrailController(ITrailService trailService, IUserService userService, ILogger<TrailController> logger)
    {
        _trailService = trailService;
        _userService = userService;
        _logger = logger;
    }

    [Route("{identifier}")]
    public async Task<ActionResult<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _trailService.GetTrailByIdentifierAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "GetTrailByIdentifierAsync: Trail with identifier: {identifier} not found.", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("popular")]
    public async Task<ActionResult<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrailsAsync(CancellationToken ctoken)
    {
        var result = await _trailService.GetPopularTrailOverviewsAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
               "GetPopularTrailsAsync: Failed to fetch popular trails.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet]
    [Route("")]
    public async Task<ActionResult<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrailsAsync(CancellationToken ctoken)
    {
        var result = await _trailService.GetAllTrailsWithBasicInfoAsync(ctoken);

        if(!result.Success && result.Message != null)
        {
            _logger.LogInformation(
              "GetAllTrailsAsync: Failed to fetch trails.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost]
    [Route("create")]
    public async Task<ActionResult> AddTrailAsync(
        [FromForm] CreateTrailRequest request,
        [FromForm] IFormFile trailSymbolImage,
        [FromForm] IFormFileCollection images,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
        {
            return Unauthorized("User not found");
        }

        var result = await _trailService.AddTrailAsync(request, trailSymbolImage, images, ctoken);

        if (!result.Success && result.Message != null)
        {
            return ToActionResult(result.Message);
        }

        if (result.Value == null)
        {
            return BadRequest("Trail could not be created.");
        }

        return Created($"/api/v1/trail/{result.Value.Identifier}", result.Value);
    }
}