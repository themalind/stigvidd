using Core.Interfaces.Services;
using Core.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace StigviddAPI.Controllers.Admin;

/// <summary>
/// Trail content management for the admin dashboard. Admin-only.
/// The read endpoints and user-submitted trail creation live in <see cref="TrailsController"/>.
/// </summary>
[ApiController]
[Route("api/v1/admin/trails")]
[Authorize(Policy = "AdminOnly")]
public class AdminTrailsController : StigViddController
{
    private readonly ITrailService _trailService;
    private readonly ILogger<AdminTrailsController> _logger;

    public AdminTrailsController(ITrailService trailService, ILogger<AdminTrailsController> logger)
    {
        _trailService = trailService;
        _logger = logger;
    }

    /// <summary>
    /// Every action here is resolved by the "AdminOnly" policy alone — none of them needs
    /// the caller's app-side user row, and the admin dashboard never provisions one.
    /// </summary>
    [HttpPut("{identifier}")]
    public async Task<ActionResult<TrailResponse?>> UpdateTrail(
        string identifier,
        [FromBody] UpdateTrailRequest request,
        CancellationToken ctoken)
    {
        var result = await _trailService.UpdateTrailAsync(request, identifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "UpdateTrail: Failed to update trail with identifier: {identifier}.", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpDelete("images/{imageIdentifier}")]
    public async Task<ActionResult> DeleteTrailImage(
        string imageIdentifier,
        CancellationToken ctoken)
    {
        var result = await _trailService.DeleteTrailImageAsync(imageIdentifier, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "DeleteTrailImage: Failed to delete image with identifier: {imageIdentifier}.", imageIdentifier);

            return ToActionResult(result.Message);
        }

        return NoContent();
    }

    [HttpPost("{identifier}/images")]
    public async Task<ActionResult<IReadOnlyCollection<TrailImageResponse>>> AddTrailImages(
        string identifier,
        [FromForm] IFormFileCollection images,
        [FromForm] ImageProcessingOptionsRequest options,
        CancellationToken ctoken)
    {
        var result = await _trailService.AddTrailImagesAsync(identifier, images, options.ToOptions(), ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "AddTrailImages: Failed to add images to trail with identifier: {identifier}.", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    [HttpPost("{identifier}/symbol")]
    public async Task<ActionResult<string>> SetTrailSymbol(
        string identifier,
        [FromForm] IFormFile symbol,
        [FromForm] ImageProcessingOptionsRequest options,
        CancellationToken ctoken)
    {
        var result = await _trailService.SetTrailSymbolAsync(identifier, symbol, options.ToOptions(), ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "SetTrailSymbol: Failed to set symbol for trail with identifier: {identifier}.", identifier);

            return ToActionResult(result.Message);
        }

        return Ok(new { symbolUrl = result.Value });
    }
}
