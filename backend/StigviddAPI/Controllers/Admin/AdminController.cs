// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StigviddAPI.Extensions;
using WebDataContracts.ResponseModels.DataTransfer;

namespace StigviddAPI.Controllers.Admin;

/// <summary>
/// Whole-environment export/import for migrating between hosts. Admin-only.
/// </summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController(IDataTransferService dataTransfer, ILogger<AdminController> logger) : ControllerBase
{
    private readonly IDataTransferService _dataTransfer = dataTransfer;
    private readonly ILogger<AdminController> _logger = logger;

    [HttpGet("transfer-info")]
    public ActionResult<DataTransferInfoResponse> GetTransferInfo() => Ok(_dataTransfer.GetInfo());

    /// <summary>Streams a full migration archive (database + media + Keycloak).</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] bool anonymize, CancellationToken ctoken)
    {
        _logger.LogInformation("Admin export (anonymize={Anonymize}) requested by {User}",
            anonymize, RequestLoggingMiddleware.SubjectId(User) ?? "unknown");

        var archive = await _dataTransfer.CreateExportAsync(anonymize, ctoken);
        var suffix = anonymize ? "-anonymized" : "";
        var fileName = $"stigvidd-export-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}{suffix}.zip";

        return File(archive, "application/zip", fileName);
    }

    /// <summary>
    /// Restores a migration archive (raw zip in the request body). DESTRUCTIVE —
    /// replaces this host's data. The response names the services to restart.
    /// </summary>
    [HttpPost("import")]
    [DisableRequestSizeLimit]
    public async Task<ActionResult<DataTransferImportResponse>> Import(CancellationToken ctoken)
    {
        _logger.LogWarning("Admin import (destructive) requested by {User}", RequestLoggingMiddleware.SubjectId(User) ?? "unknown");
        try
        {
            return Ok(await _dataTransfer.ImportAsync(Request.Body, ctoken));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Import failed");
            return BadRequest(new { message = ex.Message });
        }
    }
}
