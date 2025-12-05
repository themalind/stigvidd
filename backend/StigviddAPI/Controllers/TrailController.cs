using Core.Interfaces;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels;
using WebDataContracts.ViewModels;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TrailController(ITrailService service, ILogger<TrailController> logger) : Controller
{
    private readonly ITrailService _service = service;
    private readonly ILogger<TrailController> _logger = logger;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<TrailDTO>>> GetAllTrails(CancellationToken ctoken)
    {
        var trails = await _service.GetTrailsAsync(ctoken);

        if (trails is null)
        {
            _logger.LogInformation(
                "TrailController -> GetAllTrails: Failed to fetch any trails. Trails are null");

            return NotFound();
        }

        return Ok(trails);
    }

    [Route("{identifier}")]
    public async Task<ActionResult<TrailDTO?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var trail = await _service.GetTrailByIdentifierAsync(identifier, ctoken);

        if (trail is null)
        {
            _logger.LogInformation(
                "TrailController -> GetTrailByIdentifierAsync: Trail with identifier: {identifier} not found.", identifier);

            return NotFound();
        }

        return Ok(trail);
    }

    [HttpGet]
    [Route("popular")]
    public async Task<ActionResult<IReadOnlyCollection<TrailOverviewViewModel>>> GetPopularTrails(CancellationToken ctoken)
    {
        var trails = await _service.GetPopularTrailOverviewsAsync(ctoken);

        if (trails is null)
        {
            _logger.LogInformation(
               "TrailController -> GetPopularTrails: Failed to fetch popular trails. Trails are null");

            return NotFound();
        }

        return Ok(trails);
    }
}

