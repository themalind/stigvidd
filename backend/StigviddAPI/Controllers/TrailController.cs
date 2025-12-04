using Core.Interfaces;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.ResponseModels;
using WebDataContracts.ViewModels;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TrailController(ITrailService service) : Controller
{
    private readonly ITrailService _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<TrailDTO>>> GetAllTrails(CancellationToken token)
    {
        var trails = await _service.GetTrailsAsync(token);

        if (trails is null)
        {
            return NotFound();
        }

        return Ok(trails);
    }

    [HttpGet]
    [Route("{identifier}")]
    public async Task<ActionResult<TrailDTO?>> GetTrailByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var trail = await _service.GetTrailByIdentifierAsync(identifier, ctoken);

        if (trail is null)
        {
            return NotFound();
        }

        return Ok(trail);
    }

    [HttpGet]
    [Route("popular")]
    public async Task<ActionResult<IReadOnlyCollection<TrailOverviewViewModel>>> GetPopularTrails(CancellationToken ctoken)
    {
        var trails = await _service.GetPopularTrailOverviewsAsync(ctoken);

        if(trails is null)
        {
            return NotFound();
        }

        return Ok(trails);
    }
}

