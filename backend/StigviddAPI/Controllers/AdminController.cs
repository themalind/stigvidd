using Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace StigviddAPI.Controllers;

/// <summary>
/// Whole-environment export/import for migrating between hosts. Admin-only.
/// </summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = "Admin")]
public class AdminController(IDataTransferService dataTransfer, ILogger<AdminController> logger) : ControllerBase
{
    private readonly IDataTransferService _dataTransfer = dataTransfer;
    private readonly ILogger<AdminController> _logger = logger;

    /// <summary>Streams a full migration archive (database + media + Keycloak).</summary>
    [HttpGet("export")]
    public async Task Export(CancellationToken ctoken)
    {
        var fileName = $"stigvidd-export-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.zip";
        Response.ContentType = "application/zip";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";

        _logger.LogInformation("Admin export requested by {User}", User.Identity?.Name ?? "unknown");
        await _dataTransfer.ExportAsync(Response.Body, ctoken);
    }

    /// <summary>
    /// Restores a migration archive (raw zip in the request body). DESTRUCTIVE —
    /// replaces this host's data. Restart api + keycloak afterwards.
    /// </summary>
    [HttpPost("import")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Import(CancellationToken ctoken)
    {
        _logger.LogWarning("Admin import (destructive) requested by {User}", User.Identity?.Name ?? "unknown");
        try
        {
            await _dataTransfer.ImportAsync(Request.Body, ctoken);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogError(ex, "Import failed");
            return BadRequest(new { message = ex.Message });
        }

        return Ok(new
        {
            message = "Import complete. Restart the api and keycloak services to apply: "
                    + "docker compose restart api keycloak",
        });
    }
}
