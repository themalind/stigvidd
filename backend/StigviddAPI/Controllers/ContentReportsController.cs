// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.ContentReport;
using WebDataContracts.ResponseModels.ContentReport;

namespace StigviddAPI.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ContentReportsController : StigViddController
{
    private readonly IContentReportService _reportService;
    private readonly IUserService _userService;
    private readonly ILogger<ContentReportsController> _logger;

    public ContentReportsController(
        IContentReportService reportService,
        IUserService userService,
        ILogger<ContentReportsController> logger)
    {
        _reportService = reportService;
        _userService = userService;
        _logger = logger;
    }

    [Authorize]
    [HttpPost]
    [Route("")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<ContentReportResponse>> CreateContentReport(
        CreateContentReportRequest request,
        CancellationToken ctoken)
    {
        var user = await GetAuthenticatedUserAsync(_userService, ctoken);

        if (user is null)
        {
            return Unauthorized("User not found");
        }

        var result = await _reportService.CreateAsync(user.Identifier, request, ctoken);

        if (!result.Success && result.Message != null)
        {
            _logger.LogInformation(
                "CreateContentReport: Failed to report {contentType} {contentIdentifier} for user {user}.",
                request.ContentType, request.ContentIdentifier, user.Identifier);

            return ToActionResult(result.Message);
        }

        return Created(string.Empty, result.Value);
    }

    [Authorize]
    [HttpGet]
    [Route("reasons")]
    public ActionResult<IReadOnlyCollection<string>> GetReportReasons()
    {
        return Ok(Enum.GetNames<ReportReason>());
    }
}
