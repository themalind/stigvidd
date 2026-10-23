// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.HikeSubmission;
using WebDataContracts.ResponseModels.HikeSubmission;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class HikeSubmissionsController : StigViddController
{
    private readonly IHikeSubmissionService _submissionService;
    private readonly IUserService _userService;

    public HikeSubmissionsController(IHikeSubmissionService submissionService, IUserService userService)
    {
        _submissionService = submissionService;
        _userService = userService;
    }

    [HttpPost]
    public async Task<ActionResult<HikeSubmissionResponse>> CreateSubmission(
        [FromBody] CreateHikeSubmissionRequest request,
        CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _submissionService.CreateAsync(request, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        if (result.Value is null)
            return StatusCode(500);

        return Created($"/api/v1/hikesubmissions/{result.Value.Identifier}", result.Value);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<HikeSubmissionResponse>>> GetMySubmissions(CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _submissionService.GetMineAsync(userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [AllowWhenBanned]
    [HttpDelete("{identifier}")]
    public async Task<ActionResult> WithdrawSubmission(string identifier, CancellationToken ctoken)
    {
        var userResponse = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (userResponse == null)
            return Unauthorized("User not found");

        var result = await _submissionService.WithdrawAsync(identifier, userResponse.Identifier, ctoken);

        if (!result.Success && result.Message != null)
            return ToActionResult(result.Message);

        return NoContent();
    }
}
