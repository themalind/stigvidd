using Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.ResponseModels.Trail;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TrailController(ITrailService service, ILogger<TrailController> logger) : StigViddController
{
    private readonly ITrailService _service = service;
    private readonly ILogger<TrailController> _logger = logger;

    [Route("{identifier}")]
    public async Task<ActionResult<TrailResponse?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _service.GetTrailByIdentifierAsync(identifier, ctoken);

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
        var result = await _service.GetPopularTrailOverviewsAsync(ctoken);

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
        var result = await _service.GetAllTrailsWithBasicInfoAsync(ctoken);

        if(!result.Success && result.Message != null)
        {
            _logger.LogInformation(
              "GetAllTrailsAsync: Failed to fetch trails.");

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }
}