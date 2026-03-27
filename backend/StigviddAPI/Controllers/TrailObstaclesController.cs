using Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.TrailObstacle;
using WebDataContracts.ResponseModels.TrailObstacle;


namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TrailObstaclesController : StigViddController
{
    private readonly ITrailObstaclesService _obstaclesService;
    private readonly IUserService _userService;
    private readonly ILogger<TrailObstaclesController> _logger;

    public TrailObstaclesController(ITrailObstaclesService obstaclesService, IUserService userService, ILogger<TrailObstaclesController> logger)
    {
        _obstaclesService = obstaclesService;
        _userService = userService;
        _logger = logger;
    }

    [HttpGet]
    [Route("trail/{trailIdentifier}")]
    public async Task<ActionResult<IReadOnlyCollection<TrailObstacleResponse>>> GetTrailObstacles(
         [FromRoute] string trailIdentifier,
        CancellationToken ctoken)
    {
        var result = await _obstaclesService.GetTrailObstaclesByTrailIdentifierAsync(trailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "GetTrailObstacles: Failed to fetch obstacles for trail with identifier: {identifier}.", trailIdentifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [Authorize]
    [HttpPost]
    [Route("")]
    public async Task<ActionResult> CreateTrailObstacle(
       TrailObstacleRequest obstacleRequest,
        CancellationToken ctoken)
    {
        var user = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (user is null)
        {
            return Unauthorized("User not found");
        }

        var result = await _obstaclesService.AddTrailObstacle(
            user.Identifier,
            obstacleRequest.TrailIdentifier,
            obstacleRequest.Description,
            obstacleRequest.IssueType,
            obstacleRequest.IncidentLongitude,
            obstacleRequest.IncidentLatitude,
            ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation("AddTrailObstacle: Failed to save trail obstacle for user {user}", user.Identifier);
            return ToActionResult(result.Message);
        }

        return Created();
    }

    [Authorize]
    [HttpPost]
    [Route("solve/{trailObstacleIdentifier}")]
    public async Task<ActionResult> AddSolvedVote([FromRoute] string trailObstacleIdentifier, CancellationToken ctoken)
    {
        var user = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (user is null)
        {
            return Unauthorized("User not found");
        }

        var result = await _obstaclesService.AddSolvedVoteAsync(user.Identifier, trailObstacleIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation("AddSolvedVote: Failed to add solved vote for user: {userIdentifier}", user.Identifier);

            return ToActionResult(result.Message);
        }

        return Ok();
    }

    [Authorize]
    [HttpDelete]
    [Route("solve/{trailObstacleIdentifier}")]
    public async Task<ActionResult> DeleteSolvedVoteByUserIdentifier([FromRoute] string trailObstacleIdentifier, CancellationToken ctoken)
    {
        var user = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (user is null)
        {
            return Unauthorized("User not found");
        }

        var result = await _obstaclesService.DeleteSolvedVoteByUserIdentifierAsync(user.Identifier, trailObstacleIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation("DeleteSolvedVoteByUserIdentifier: Failed to delete solved vote for user: {userIdentifier}", user.Identifier);

            return ToActionResult(result.Message);
        }

        return NoContent();
    }
}
