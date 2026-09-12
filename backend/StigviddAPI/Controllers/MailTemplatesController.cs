// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.MailTemplate;
using WebDataContracts.ResponseModels.MailTemplate;

namespace StigviddAPI.Controllers;

/// <summary>
/// Editing the copy the API mails out. The rows live in the database rather than the
/// assembly so wording can be corrected without a deploy; this is the surface that makes
/// that possible without hand-written SQL on the host. Admin-only.
/// </summary>
[ApiController]
[Route("api/v1/admin/mail-templates")]
[Authorize(Policy = "Admin")]
public class MailTemplatesController : StigViddController
{
    private readonly IMailTemplateAdminService _mailTemplates;
    private readonly ILogger<MailTemplatesController> _logger;

    public MailTemplatesController(
        IMailTemplateAdminService mailTemplates, ILogger<MailTemplatesController> logger)
    {
        _mailTemplates = mailTemplates;
        _logger = logger;
    }

    /// <summary>Every template, with the counts that say which need attention.</summary>
    [HttpGet]
    public async Task<ActionResult<List<MailTemplateListItemResponse>>> GetAll(CancellationToken ctoken)
    {
        var result = await _mailTemplates.ListAsync(ctoken);

        return result.IsFailure ? ToActionResult(result.Message!) : Ok(result.Value);
    }

    /// <summary>One template, with every placeholder its caller supplies.</summary>
    [HttpGet("{identifier}")]
    public async Task<ActionResult<MailTemplateResponse>> GetByIdentifier(
        string identifier, CancellationToken ctoken)
    {
        var result = await _mailTemplates.GetAsync(identifier, ctoken);

        return result.IsFailure ? ToActionResult(result.Message!) : Ok(result.Value);
    }

    /// <summary>
    /// Saves new copy. Key and Language are not editable: they are what the calling code
    /// passes to the outbox. Refused with a 400 if the copy uses a placeholder the caller
    /// does not supply, because such a mail fails to render and is never sent.
    /// </summary>
    [HttpPut("{identifier}")]
    public async Task<ActionResult<MailTemplateResponse>> Update(
        string identifier, [FromBody] UpdateMailTemplateRequest request, CancellationToken ctoken)
    {
        _logger.LogInformation(
            "Mail template {identifier} edited by {user}", identifier, User.Identity?.Name ?? "unknown");

        var result = await _mailTemplates.UpdateAsync(identifier, request, ctoken);

        return result.IsFailure ? ToActionResult(result.Message!) : Ok(result.Value);
    }

    /// <summary>
    /// Renders an unsaved draft with sample values, through the renderer a real send uses.
    /// Writes nothing and sends nothing.
    /// </summary>
    [HttpPost("{identifier}/preview")]
    public async Task<ActionResult<MailTemplatePreviewResponse>> Preview(
        string identifier, [FromBody] PreviewMailTemplateRequest request, CancellationToken ctoken)
    {
        var result = await _mailTemplates.PreviewAsync(identifier, request, ctoken);

        return result.IsFailure ? ToActionResult(result.Message!) : Ok(result.Value);
    }
}
