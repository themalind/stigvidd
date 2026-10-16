// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.HikeSubmission;
using WebDataContracts.ResponseModels.HikeSubmission;

namespace StigviddAPI.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/hike-submissions")]
[Authorize(Policy = "AdminOnly")]
public class AdminHikeSubmissionsController : StigViddController
{
    private readonly IHikeSubmissionService _submissionService;

    public AdminHikeSubmissionsController(IHikeSubmissionService submissionService)
    {
        _submissionService = submissionService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<AdminHikeSubmissionListItemResponse>>> GetSubmissions(
        [FromQuery] string? status,
        CancellationToken ctoken)
    {
        var result = await _submissionService.ListForAdminAsync(status, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpGet("{identifier}")]
    public async Task<ActionResult<AdminHikeSubmissionResponse>> GetSubmission(string identifier, CancellationToken ctoken)
    {
        var result = await _submissionService.GetForAdminAsync(identifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpPut("{identifier}")]
    public async Task<ActionResult<AdminHikeSubmissionResponse>> UpdateSubmission(
        string identifier,
        [FromBody] UpdateHikeSubmissionRequest request,
        CancellationToken ctoken)
    {
        var result = await _submissionService.UpdateAsync(identifier, request, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpPut("{identifier}/geometry")]
    public async Task<ActionResult<AdminHikeSubmissionResponse>> UpdateSubmissionGeometry(
        string identifier,
        [FromBody] UpdateHikeSubmissionGeometryRequest request,
        CancellationToken ctoken)
    {
        var result = await _submissionService.UpdateGeometryAsync(identifier, request, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpDelete("{identifier}/images/{imageIdentifier}")]
    public async Task<ActionResult> DeleteSubmissionImage(string identifier, string imageIdentifier, CancellationToken ctoken)
    {
        var result = await _submissionService.DeleteImageAsync(identifier, imageIdentifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    [HttpPost("{identifier}/approve")]
    public async Task<ActionResult<ApproveHikeSubmissionResponse>> ApproveSubmission(string identifier, CancellationToken ctoken)
    {
        var result = await _submissionService.ApproveAsync(identifier, CurrentUser(), ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(new ApproveHikeSubmissionResponse { TrailIdentifier = result.Value ?? string.Empty });
    }

    [HttpPost("{identifier}/reject")]
    public async Task<ActionResult> RejectSubmission(
        string identifier,
        [FromBody] RejectHikeSubmissionRequest request,
        CancellationToken ctoken)
    {
        var result = await _submissionService.RejectAsync(identifier, request, CurrentUser(), ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    private string CurrentUser() => User.Identity?.Name ?? "unknown";
}
