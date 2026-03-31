using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TrailsController : StigViddController
{
    private readonly ITrailService _trailService;
    private readonly IUserService _userService;
    private readonly ILogger<TrailsController> _logger;

    public TrailsController(ITrailService trailService, IUserService userService, ILogger<TrailsController> logger)
    {
        _trailService = trailService;
        _userService = userService;
        _logger = logger;
    }

    [HttpGet("{identifier}")]
    public async Task<ActionResult<TrailResponse?>> GetTrailByIdentifier(
        string identifier,
        CancellationToken ctoken)
    {
        var result = await _trailService.GetTrailByIdentifierWithoutCoordinatesAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "GetTrailByIdentifierAsync: Trail with identifier: {identifier} not found.", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("popular")]
    public async Task<ActionResult<IReadOnlyCollection<TrailOverviewResponse?>>> GetPopularTrails(
        [FromQuery] double? latitude,
        [FromQuery] double? longitude,
        CancellationToken ctoken)
    {
        var result = await _trailService.GetPopularTrailOverviewsAsync(latitude, longitude, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
               "GetPopularTrailsAsync: Failed to fetch popular trails.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("")]
    public async Task<ActionResult<IReadOnlyCollection<TrailShortInfoResponse>>> GetAllTrails(CancellationToken ctoken)
    {
        var result = await _trailService.GetAllTrailsWithBasicInfoAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
              "GetAllTrailsAsync: Failed to fetch trails.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("{identifier}/coordinates")]
    public async Task<ActionResult<CoordinatesResponse?>> GetCoordinatesByTrailIdentifier(
        string identifier,
        CancellationToken ctoken)
    {
        var result = await _trailService.GetCoordinatesByTrailIdentifierAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
              "GetAllCordsByTrailIdentifierAsync: Failed to fetch cords. {identifier}", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("markers")]
    public async Task<ActionResult<IReadOnlyCollection<TrailMarkerResponse>>> GetTrailMarkers(
               CancellationToken ctoken)
    {
        var result = await _trailService.GetAllTrailMarkersAsync(ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
              "GetTrailMarkersAsync: Failed to fetch trail markers.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost]
    [Route("create")]
    public async Task<ActionResult> AddTrail(
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

        var result = await _trailService.AddTrailAsync(request, trailSymbolImage, images, userResponse.Identifier, ctoken);

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