using Core.Interfaces.Services;
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
                "GetTrailByIdentifier: Trail with identifier: {identifier} not found.", identifier);

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
               "GetPopularTrails Failed to fetch popular trails.");

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
              "GetAllTrails: Failed to fetch trails.");

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
              "GetAllCordsByTrailIdentifier: Failed to fetch cords. {identifier}", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpGet("paths")]
    public async Task<ActionResult<IReadOnlyCollection<TrailPathResponse>>> GetTrailPaths(
        [FromQuery] double minLat,
        [FromQuery] double minLon,
        [FromQuery] double maxLat,
        [FromQuery] double maxLon,
        CancellationToken ctoken)
    {
        var result = await _trailService.GetTrailPathsInBoundsAsync(minLat, minLon, maxLat, maxLon, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation("GetTrailPaths: Failed to fetch trail paths.");
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
              "GetTrailMarkers: Failed to fetch trail markers.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPut("{identifier}")]
    public async Task<ActionResult<TrailResponse?>> UpdateTrail(
        string identifier,
        [FromBody] UpdateTrailRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _trailService.UpdateTrailAsync(request, identifier, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "UpdateTrail: Failed to update trail with identifier: {identifier}.", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpDelete("images/{imageIdentifier}")]
    public async Task<ActionResult> DeleteTrailImage(
        string imageIdentifier,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _trailService.DeleteTrailImageAsync(imageIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "DeleteTrailImage: Failed to delete image with identifier: {imageIdentifier}.", imageIdentifier);

            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [Authorize]
    [HttpPost("{identifier}/images")]
    public async Task<ActionResult<IReadOnlyCollection<TrailImageResponse>>> AddTrailImages(
        string identifier,
        [FromForm] IFormFileCollection images,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _trailService.AddTrailImagesAsync(identifier, images, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "AddTrailImages: Failed to add images to trail with identifier: {identifier}.", identifier);

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