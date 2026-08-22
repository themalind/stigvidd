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

    public AdminMediaController(IMediaService mediaService)
    {
        _mediaService = mediaService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<MediaItemResponse>>> GetAll(CancellationToken ctoken)
    {
        var result = await _mediaService.GetAllMediaAsync(ctoken);

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
}
