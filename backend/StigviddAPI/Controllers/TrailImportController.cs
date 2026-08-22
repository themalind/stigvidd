using Core.Common;
using Core.Interfaces.Services;
using Infrastructure.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebDataContracts.RequestModels.TrailImport;
using WebDataContracts.ResponseModels.TrailImport;

namespace StigviddAPI.Controllers;

/// <summary>
/// Reviewing a source export before any of it reaches Trails. Upload, analyse, work
/// through the proposals. Nothing here writes to Trails; that is the apply phase.
/// </summary>
[ApiController]
[Route("api/v1/admin/trail-import")]
[Authorize(Policy = "Admin")]
public class TrailImportController : StigViddController
{
    private readonly ITrailImportService _trailImport;
    private readonly ILogger<TrailImportController> _logger;

    public TrailImportController(ITrailImportService trailImport, ILogger<TrailImportController> logger)
    {
        _trailImport = trailImport;
        _logger = logger;
    }

    /// <summary>Uploads a GeoJSON export and opens a session for it.</summary>
    [HttpPost("sessions")]
    public async Task<ActionResult<TrailImportSessionResponse>> CreateSession(
        [FromForm] IFormFile file,
        [FromForm] string? source,
        CancellationToken ctoken)
    {
        if (file is null || file.Length == 0)
            return BadRequest("A file is required.");

        await using var content = file.OpenReadStream();

        var result = await _trailImport.CreateSessionAsync(content, file.FileName, source, CurrentUser(), ctoken);

        if (result.IsFailure && result.Message is not null)
        {
            _logger.LogInformation("CreateSession: Upload of {fileName} was rejected.", file.FileName);
            return ToActionResult(result.Message);
        }

        return Created($"/api/v1/admin/trail-import/sessions/{result.Value!.Id}", result.Value);
    }

    /// <summary>Queues the analysis. Returns straight away; poll the session for progress.</summary>
    [HttpPost("sessions/{id:int}/analyze")]
    public async Task<ActionResult<TrailImportSessionResponse>> Analyze([FromRoute] int id, CancellationToken ctoken)
    {
        var result = await _trailImport.QueueAnalysisAsync(id, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Accepted(result.Value);
    }

    [HttpGet("sessions")]
    public async Task<ActionResult<IReadOnlyCollection<TrailImportSessionResponse>>> GetSessions(CancellationToken ctoken)
    {
        var result = await _trailImport.GetSessionsAsync(ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    /// <summary>One session with the counts per confidence and per decision.</summary>
    [HttpGet("sessions/{id:int}")]
    public async Task<ActionResult<TrailImportSessionResponse>> GetSession([FromRoute] int id, CancellationToken ctoken)
    {
        var result = await _trailImport.GetSessionAsync(id, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpGet("sessions/{id:int}/proposals")]
    public async Task<ActionResult<PagedResult<TrailImportProposalResponse>>> GetProposals(
        [FromRoute] int id,
        [FromQuery] string? confidence,
        [FromQuery] string? decision,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ctoken = default)
    {
        var result = await _trailImport.GetProposalsAsync(id, confidence, decision, page, pageSize, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    /// <summary>Both lines as coordinate pairs, plus the lengths needed to judge the match.</summary>
    [HttpGet("sessions/{id:int}/proposals/{proposalId:int}/preview")]
    public async Task<ActionResult<TrailImportPreviewResponse>> GetPreview(
        [FromRoute] int id, [FromRoute] int proposalId, CancellationToken ctoken)
    {
        var result = await _trailImport.GetPreviewAsync(id, proposalId, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(result.Value);
    }

    [HttpPost("sessions/{id:int}/proposals/{proposalId:int}/decide")]
    public async Task<ActionResult> Decide(
        [FromRoute] int id,
        [FromRoute] int proposalId,
        [FromBody] DecideProposalRequest request,
        CancellationToken ctoken)
    {
        var result = await _trailImport.DecideAsync(
            id, [proposalId], request.Decision, request.TrailIdentifier, request.Role, request.Note,
            new ProposalOverrides(request.Name, request.LengthKm), CurrentUser(), ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    /// <summary>The same decision across a batch, for clearing the certain matches at once.</summary>
    [HttpPost("sessions/{id:int}/decide-bulk")]
    public async Task<ActionResult<int>> DecideBulk(
        [FromRoute] int id,
        [FromBody] DecideProposalsBulkRequest request,
        CancellationToken ctoken)
    {
        var result = await _trailImport.DecideAsync(
            id, request.ProposalIds, request.Decision, trailIdentifier: null, request.Role, request.Note,
            overrides: null, CurrentUser(), ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return Ok(new { decided = result.Value });
    }

    /// <summary>Drops the session, its proposals and the uploaded file. Trails are untouched.</summary>
    [HttpDelete("sessions/{id:int}")]
    public async Task<ActionResult> DeleteSession([FromRoute] int id, CancellationToken ctoken)
    {
        _logger.LogInformation("DeleteSession: Session {sessionId} deletion requested by {user}.", id, CurrentUser());

        var result = await _trailImport.DeleteSessionAsync(id, ctoken);

        if (result.IsFailure && result.Message is not null)
            return ToActionResult(result.Message);

        return NoContent();
    }

    /// <summary>The confidence and decision names the filters and requests accept.</summary>
    [HttpGet("vocabulary")]
    public ActionResult GetVocabulary() => Ok(new
    {
        confidences = Enum.GetNames<MatchConfidence>(),
        decisions = Enum.GetNames<ProposalDecision>(),
        roles = Enum.GetNames<TrailSourceLinkRole>(),
        statuses = Enum.GetNames<ImportSessionStatus>(),
    });

    private string CurrentUser() => User.Identity?.Name ?? "unknown";
}
