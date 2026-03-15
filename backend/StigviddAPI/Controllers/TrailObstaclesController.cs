using Core.Interfaces;
using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TrailObstaclesController : StigViddController
{
    private readonly ITrailObstaclesService _obstaclesService;
    private readonly ILogger<TrailObstaclesController> _logger;

    public TrailObstaclesController(ITrailObstaclesService obstaclesService, ILogger<TrailObstaclesController> logger)
    {
        _obstaclesService = obstaclesService;
        _logger = logger;
    }

    [HttpGet]
    [Route("trail/{trailIdentifier}")]
    public async Task<ActionResult<IReadOnlyCollection<TrailObstacleResponse>>> GetTrailObstaclesAsync(
         [FromRoute] string trailIdentifier, 
        CancellationToken ctoken)
    {
        var result = await _obstaclesService.GetTrailObstaclesByTrailIdentifierAsync(trailIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "GetTrailObstaclesAsync: Failed to fetch obstacles for trail with identifier: {identifier}.", trailIdentifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }
}
