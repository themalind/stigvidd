// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.MailOutbox;
using WebDataContracts.ResponseModels.MailOutbox;

namespace StigviddAPI.Controllers.Admin;

/// <summary>
/// The mail outbox: what the API has queued, sent, failed to send, or been stopped from
/// sending. This is where an operator diagnoses a mail that never arrived, and the only place
/// a failed one can be pushed back into the queue. Admin-only.
/// </summary>
[ApiController]
[Route("api/v1/admin/mail-outbox")]
[Authorize(Policy = "AdminOnly")]
public class AdminMailOutboxController : StigViddController
{
    private readonly IMailOutboxAdminService _outbox;
    private readonly ILogger<AdminMailOutboxController> _logger;

    public AdminMailOutboxController(
        IMailOutboxAdminService outbox, ILogger<AdminMailOutboxController> logger)
    {
        _outbox = outbox;
        _logger = logger;
    }

    /// <summary>The outbox, newest first. Page numbers are 1-indexed. Carries no mail bodies.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<OutboxEmailSummaryResponse>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? templateKey,
        [FromQuery] string? recipient,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken ctoken)
    {
        var result = await _outbox.GetPagedAsync(status, templateKey, recipient, page, pageSize, ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }

    /// <summary>One count per status, so the page can show what is outstanding.</summary>
    [HttpGet("counts")]
    public async Task<ActionResult<MailOutboxCountsResponse>> GetCounts(CancellationToken ctoken)
    {
        var result = await _outbox.GetCountsAsync(ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }

    /// <summary>
    /// One mail, without its rendered bodies. Those are at {identifier}/body.
    /// </summary>
    [HttpGet("{identifier}")]
    public async Task<ActionResult<OutboxEmailDetailResponse>> GetByIdentifier(
        [FromRoute] string identifier, CancellationToken ctoken)
    {
        var result = await _outbox.GetDetailAsync(identifier, ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }

    /// <summary>
    /// The rendered bodies of one mail. 404 once they have been cleared under the retention
    /// policy.
    /// </summary>
    /// <remarks>
    /// A route of its own rather than part of the detail response, because this is where the
    /// personal data in the outbox actually is: the copy carries a nickname, and a verify-email
    /// or reset-password body carries a working token URL. Retry, cancel and purge have always
    /// logged the operator who did them; reading a body is at least as worth recording, and
    /// until this split it happened to every row anyone clicked.
    /// </remarks>
    [HttpGet("{identifier}/body")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OutboxEmailBodyResponse>> GetBody(
        [FromRoute] string identifier, CancellationToken ctoken)
    {
        _logger.LogInformation(
            "Mail body {identifier} read by {user}", identifier, User.Identity?.Name ?? "unknown");

        var result = await _outbox.GetBodyAsync(identifier, ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }

    /// <summary>
    /// Puts a failed or cancelled mail back in the queue, due now and with its attempt ladder
    /// reset. A mail that is being sent right now is refused with a 409.
    /// </summary>
    [HttpPost("{identifier}/retry")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OutboxEmailDetailResponse>> Retry(
        [FromRoute] string identifier, CancellationToken ctoken)
    {
        _logger.LogInformation(
            "Mail {identifier} retried by {user}", identifier, User.Identity?.Name ?? "unknown");

        var result = await _outbox.RetryAsync(identifier, ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }

    /// <summary>
    /// Stops a mail that is still waiting. Anything already claimed, sent, failed or cancelled
    /// is refused with a 409 — cancelling cannot un-send.
    /// </summary>
    [HttpPost("{identifier}/cancel")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OutboxEmailDetailResponse>> Cancel(
        [FromRoute] string identifier, CancellationToken ctoken)
    {
        _logger.LogInformation(
            "Mail {identifier} cancelled by {user}", identifier, User.Identity?.Name ?? "unknown");

        var result = await _outbox.CancelAsync(identifier, ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }

    /// <summary>
    /// Deletes SENT mail older than the requested cutoff, and nothing else — pending, sending,
    /// failed and cancelled rows are never touched at any setting. Cannot be undone.
    /// </summary>
    [HttpPost("purge")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MailOutboxPurgeResponse>> Purge(
        [FromBody] PurgeMailOutboxRequest request, CancellationToken ctoken)
    {
        _logger.LogWarning(
            "Mail outbox purge of mail older than {days} day(s) requested by {user}",
            request.OlderThanDays,
            User.Identity?.Name ?? "unknown");

        var result = await _outbox.PurgeAsync(request, ctoken);

        return result.IsFailure && result.Message is not null
            ? ToActionResult(result.Message)
            : Ok(result.Value);
    }
}
