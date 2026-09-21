// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Media;

namespace StigviddAPI.Controllers.Admin;

/// <summary>
/// The media library behind the admin dashboard's Media page. Admin-only;
/// no other client reads or edits image metadata.
/// </summary>
[ApiController]
[Route("api/v1/admin/media")]
[Authorize(Policy = "AdminOnly")]
public class AdminMediaController : StigViddController
{
    private readonly IMediaService _mediaService;
    private readonly IMediaReprocessService _reprocessService;

    public AdminMediaController(IMediaService mediaService, IMediaReprocessService reprocessService)
    {
        _mediaService = mediaService;
        _reprocessService = reprocessService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(MediaLibraryPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MediaLibraryPageResponse>> GetAll(
        [FromQuery] MediaLibraryQuery query, CancellationToken ctoken)
    {
        var result = await _mediaService.GetMediaAsync(query, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpPatch("{imageIdentifier}")]
    public async Task<ActionResult> UpdateMetadata(
        string imageIdentifier,
        [FromBody] UpdateImageMetadataRequest request,
        CancellationToken ctoken)
    {
        var result = await _mediaService.UpdateImageMetadataAsync(imageIdentifier, request.AltText, request.Caption, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    [HttpPost("reprocess")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MediaReprocessJobSummaryResponse>> CreateReprocessJob(
        [FromBody] CreateMediaReprocessJobRequest request, CancellationToken ctoken)
    {
        var result = await _reprocessService.EnqueueBatchAsync(request, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        if (result.Value is null)
            return ToActionResult(new Message(StatusCodes.Status500InternalServerError, "An error occurred while creating the batch."));

        return CreatedAtAction(nameof(GetReprocessJob), new { identifier = result.Value.Identifier }, result.Value);
    }

    [HttpGet("reprocess")]
    public async Task<ActionResult<PagedResult<MediaReprocessJobSummaryResponse>>> GetReprocessJobs(
        [FromQuery] int page, [FromQuery] int pageSize, CancellationToken ctoken)
    {
        var result = await _reprocessService.GetJobsPagedAsync(page, pageSize, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpGet("reprocess/{identifier}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaReprocessJobDetailResponse>> GetReprocessJob(
        [FromRoute] string identifier, CancellationToken ctoken)
    {
        var result = await _reprocessService.GetJobDetailAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpPost("reprocess/{identifier}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaReprocessJobSummaryResponse>> CancelReprocessJob(
        [FromRoute] string identifier, CancellationToken ctoken)
    {
        var result = await _reprocessService.CancelJobAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }
}
