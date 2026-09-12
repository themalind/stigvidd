// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.ContentReport;
using WebDataContracts.ResponseModels.ContentReport;

namespace StigviddAPI.Controllers;

/// <summary>
/// The moderation queue. Reported content is already hidden by the time it appears here;
/// what happens next is either putting it back or deleting it for good.
/// </summary>
[ApiController]
[Route("api/v1/admin/content-reports")]
[Authorize(Policy = "Admin")]
public class AdminContentReportsController : StigViddController
{
    private readonly IContentReportService _reportService;
    private readonly ILogger<AdminContentReportsController> _logger;

    public AdminContentReportsController(
        IContentReportService reportService,
        ILogger<AdminContentReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    /// <summary>The queue, oldest pending first. Page numbers are 1-indexed.</summary>
    [HttpGet("reports")]
    public async Task<ActionResult<PagedResult<ContentReportSummaryResponse>>> GetReports(
        [FromQuery] string? status,
        [FromQuery] string? contentType,
        [FromQuery] string? hideOutcome,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken ctoken)
    {
        var result = await _reportService.GetQueueAsync(status, contentType, hideOutcome, page, pageSize, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    /// <summary>One report, with the author's strike count and the reporter's record.</summary>
    [HttpGet("reports/{identifier}")]
    public async Task<ActionResult<ContentReportDetailResponse>> GetReport(
        [FromRoute] string identifier,
        CancellationToken ctoken)
    {
        var result = await _reportService.GetDetailAsync(identifier, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpGet("counts")]
    public async Task<ActionResult<ContentReportCountsResponse>> GetCounts(CancellationToken ctoken)
    {
        var result = await _reportService.GetCountsAsync(ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    /// <summary>
    /// Dismiss puts the content back; Uphold deletes it permanently and records a strike.
    /// The decision settles every pending report on the same content, not just this row.
    /// </summary>
    [HttpPost("reports/{identifier}/decide")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ContentReportDetailResponse>> Decide(
        [FromRoute] string identifier,
        DecideContentReportRequest request,
        CancellationToken ctoken)
    {
        var result = await _reportService.DecideAsync(identifier, request, CurrentUser(), ctoken);

        if (result.IsFailure && result.Message is not null)
        {
            _logger.LogInformation("Decide: {decision} on report {identifier} was rejected.", request.Decision, identifier);
            return ToActionResult(result.Message);
        }

        return Ok(result.Value);
    }

    /// <summary>
    /// Who reports, and how often they turn out to be right. Sorted by dismissed reports,
    /// most first.
    /// </summary>
    [HttpGet("reporters")]
    public async Task<ActionResult<PagedResult<ReporterStatisticResponse>>> GetReporters(
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken ctoken)
    {
        var result = await _reportService.GetReporterStatisticsAsync(page, pageSize, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    /// <summary>Strikes per author, counted on distinct content, most first.</summary>
    [HttpGet("authors")]
    public async Task<ActionResult<PagedResult<AuthorStatisticResponse>>> GetAuthors(
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken ctoken)
    {
        var result = await _reportService.GetAuthorStatisticsAsync(page, pageSize, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    /// <summary>The enum names the admin filters are built from.</summary>
    [HttpGet("vocabulary")]
    public ActionResult GetVocabulary() => Ok(new
    {
        contentTypes = Enum.GetNames<ReportedContentType>(),
        hideOutcomes = Enum.GetNames<ReportHideOutcome>(),
        reasons = Enum.GetNames<ReportReason>(),
        statuses = Enum.GetNames<ReportStatus>(),
    });

    private string CurrentUser() => User.Identity?.Name ?? "unknown";
}
