using Core.Common;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Net;
using WebDataContracts.ResponseModels.TrailImport;

namespace Core.Services;

// The admin side of the sync: uploading a source file, queueing the analysis, and walking
// the proposals it produced. Decides nothing about trails itself — nothing here writes to
// Trails, which only the apply phase does.
public class TrailImportService : ITrailImportService
{
    public const string DefaultSource = "boras-stad";

    private const int MaxPageSize = 200;
    private const int DefaultPageSize = 50;

    private static readonly string[] AllowedExtensions = [".geojson", ".json"];

    private readonly ITrailImportRepository _repository;
    private readonly ITrailImportFileStore _fileStore;
    private readonly ITrailImportAnalysisQueue _queue;
    private readonly ILogger<TrailImportService> _logger;

    public TrailImportService(
        ITrailImportRepository repository,
        ITrailImportFileStore fileStore,
        ITrailImportAnalysisQueue queue,
        ILogger<TrailImportService> logger)
    {
        _repository = repository;
        _fileStore = fileStore;
        _queue = queue;
        _logger = logger;
    }

    public async Task<Result<TrailImportSessionResponse>> CreateSessionAsync(
        Stream content, string fileName, string? source, string uploadedBy, CancellationToken ctoken)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return Result.Fail<TrailImportSessionResponse>(new Message((int)HttpStatusCode.BadRequest, "A file name is required."));

        var extension = Path.GetExtension(fileName);

        if (!AllowedExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.BadRequest, "The file must be GeoJSON (.geojson or .json)."));

        var effectiveSource = string.IsNullOrWhiteSpace(source) ? DefaultSource : source.Trim();

        StoredImportFile stored;

        try
        {
            stored = await _fileStore.SaveAsync(content, fileName, ctoken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportService: CreateSessionAsync -> {fileName} could not be stored.", fileName);
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.InternalServerError, "The file could not be stored."));
        }

        if (stored.SizeBytes == 0)
        {
            _fileStore.Delete(stored.StoredPath);
            return Result.Fail<TrailImportSessionResponse>(new Message((int)HttpStatusCode.BadRequest, "The file is empty."));
        }

        var earlier = await _repository.GetSessionsByFileHashAsync(effectiveSource, stored.FileHash, ctoken);

        var session = new TrailImportSession
        {
            Source = effectiveSource,
            FileName = Path.GetFileName(fileName),
            FileSizeBytes = stored.SizeBytes,
            FileHash = stored.FileHash,
            StoredPath = stored.StoredPath,
            Status = ImportSessionStatus.Uploaded,
            UploadedBy = uploadedBy,
        };

        var created = await _repository.AddSessionAsync(session, ctoken);

        if (!created.IsSuccess)
        {
            // The row is what makes the file findable, so an orphan is deleted rather than left.
            _fileStore.Delete(stored.StoredPath);
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.InternalServerError, "The session could not be created."));
        }

        var response = ToResponse(created.Value, counts: null);

        response.DuplicateOf = earlier.IsSuccess
            ? earlier.Value.Select(s => s.Identifier).ToList()
            : [];

        _logger.LogInformation(
            "TrailImportService: Session {sessionId} created from {fileName} ({bytes} bytes) by {user}.",
            created.Value.Id, session.FileName, stored.SizeBytes, uploadedBy);

        return Result.Ok(response);
    }

    public async Task<Result<TrailImportSessionResponse>> QueueAnalysisAsync(int sessionId, CancellationToken ctoken)
    {
        var found = await _repository.GetSessionAsync(sessionId, ctoken);

        if (!found.IsSuccess)
            return SessionFailure<TrailImportSessionResponse>(found.Status, sessionId);

        var session = found.Value;

        // Analyzing means a worker already holds it, Applying means the apply phase does.
        if (session.Status is ImportSessionStatus.Analyzing or ImportSessionStatus.Applying)
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.Conflict, "The session is already being processed."));

        if (session.Status == ImportSessionStatus.Applied)
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.Conflict, "The session has already been applied and cannot be analysed again."));

        if (!File.Exists(session.StoredPath))
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.Conflict, "The uploaded file is no longer on disk. Upload it again."));

        // Set here rather than in the worker so the queued session cannot be queued twice
        // while it waits its turn.
        session.Status = ImportSessionStatus.Analyzing;
        session.ErrorMessage = null;

        var updated = await _repository.UpdateSessionAsync(session, ctoken);

        if (!updated.IsSuccess)
            return Result.Fail<TrailImportSessionResponse>(new Message(
                (int)HttpStatusCode.InternalServerError, "The session could not be queued."));

        _queue.Enqueue(session.Id);

        _logger.LogInformation("TrailImportService: Session {sessionId} queued for analysis.", session.Id);

        return Result.Ok(ToResponse(session, counts: null));
    }

    public async Task<Result<IReadOnlyCollection<TrailImportSessionResponse>>> GetSessionsAsync(CancellationToken ctoken)
    {
        var sessions = await _repository.GetSessionsAsync(ctoken);

        if (!sessions.IsSuccess)
            return Result.Fail<IReadOnlyCollection<TrailImportSessionResponse>>(new Message(
                (int)HttpStatusCode.InternalServerError, "The sessions could not be listed."));

        // No counts on the list: one grouped query per session would turn a page of ten
        // into twenty round trips for a number the list does not show.
        return Result.Ok<IReadOnlyCollection<TrailImportSessionResponse>>(
            sessions.Value.Select(s => ToResponse(s, counts: null)).ToList());
    }

    public async Task<Result<TrailImportSessionResponse>> GetSessionAsync(int sessionId, CancellationToken ctoken)
    {
        var found = await _repository.GetSessionAsync(sessionId, ctoken);

        if (!found.IsSuccess)
            return SessionFailure<TrailImportSessionResponse>(found.Status, sessionId);

        var counts = await _repository.GetProposalCountsAsync(sessionId, ctoken);

        return Result.Ok(ToResponse(found.Value, counts.IsSuccess ? counts.Value : null));
    }

    public async Task<Result<PagedResult<TrailImportProposalResponse>>> GetProposalsAsync(
        int sessionId, string? confidence, string? decision, int page, int pageSize, CancellationToken ctoken)
    {
        if (!TryParseFilter<MatchConfidence>(confidence, out var parsedConfidence))
            return Result.Fail<PagedResult<TrailImportProposalResponse>>(new Message(
                (int)HttpStatusCode.BadRequest, $"Unknown confidence. Use one of: {string.Join(", ", Enum.GetNames<MatchConfidence>())}."));

        if (!TryParseFilter<ProposalDecision>(decision, out var parsedDecision))
            return Result.Fail<PagedResult<TrailImportProposalResponse>>(new Message(
                (int)HttpStatusCode.BadRequest, $"Unknown decision. Use one of: {string.Join(", ", Enum.GetNames<ProposalDecision>())}."));

        var found = await _repository.GetSessionAsync(sessionId, ctoken);

        if (!found.IsSuccess)
            return SessionFailure<PagedResult<TrailImportProposalResponse>>(found.Status, sessionId);

        var proposals = await _repository.GetProposalsAsync(
            sessionId, parsedConfidence, parsedDecision, Math.Max(page, 1), ClampPageSize(pageSize), ctoken);

        if (!proposals.IsSuccess)
            return Result.Fail<PagedResult<TrailImportProposalResponse>>(new Message(
                (int)HttpStatusCode.InternalServerError, "The proposals could not be listed."));

        var items = proposals.Value.Items.Select(ToResponse).ToList();

        return Result.Ok(new PagedResult<TrailImportProposalResponse>(
            items, proposals.Value.Page, proposals.Value.HasMore, proposals.Value.TotalCount));
    }

    public async Task<Result<TrailImportPreviewResponse>> GetPreviewAsync(int sessionId, int proposalId, CancellationToken ctoken)
    {
        var found = await _repository.GetProposalAsync(sessionId, proposalId, ctoken);

        if (!found.IsSuccess)
            return found.Status == RepositoryResultStatus.NotFound
                ? Result.Fail<TrailImportPreviewResponse>(new Message((int)HttpStatusCode.NotFound, "The proposal was not found."))
                : Result.Fail<TrailImportPreviewResponse>(new Message((int)HttpStatusCode.InternalServerError, "The proposal could not be read."));

        var proposal = found.Value;

        if (proposal.FeatureGeometry is null)
            return Result.Fail<TrailImportPreviewResponse>(new Message(
                (int)HttpStatusCode.Conflict, "The proposal has no geometry to preview."));

        var stated = TrailLength.Parse(ReadSourceLength(proposal.FeatureProperties));
        var measured = TrailLength.FromGeometry(proposal.FeatureGeometry);

        var preview = new TrailImportPreviewResponse
        {
            ProposalId = proposal.Id,
            FeatureName = proposal.FeatureName,
            Confidence = proposal.Confidence.ToString(),
            MatchReason = proposal.MatchReason,
            CoverageForward = proposal.CoverageForward,
            CoverageBackward = proposal.CoverageBackward,
            HausdorffMeters = proposal.HausdorffMeters,
            FeatureCoordinates = ToCoordinates(proposal.FeatureGeometry),
            FeatureLengthKm = measured,
            SourceStatedLengthKm = stated,
            SourceLengthDisagrees = stated.HasValue && TrailLength.Disagrees(stated.Value, measured),
            FeatureProperties = proposal.FeatureProperties,
        };

        // The decided trail wins over the suggested one: once a reviewer has relinked the
        // feature, the preview has to show what they picked. Failing both, the nearest
        // trail is drawn so an unmatched feature can be placed against something.
        var trailId = proposal.DecidedTrailId ?? proposal.SuggestedTrailId;
        preview.TrailIsNearestOnly = trailId is null;
        trailId ??= proposal.NearestTrailId;

        if (trailId is null)
            return Result.Ok(preview);

        var trail = await _repository.GetTrailForReviewAsync(trailId.Value, ctoken);

        if (!trail.IsSuccess)
        {
            // A trail deleted since the analysis ran. The feature still previews on its own.
            _logger.LogInformation("TrailImportService: Trail {trailId} on proposal {proposalId} could not be read.", trailId, proposalId);
            return Result.Ok(preview);
        }

        // Only what the feature is actually aimed at can be shared; the nearest trail is
        // drawn for orientation and nothing is linked to it.
        if (!preview.TrailIsNearestOnly)
        {
            var siblings = await _repository.GetSiblingsOnTrailAsync(sessionId, proposalId, trailId.Value, ctoken);

            if (siblings.IsSuccess)
                preview.SharingTheTrail = [.. siblings.Value.Select(s => new TrailImportSiblingResponse
                {
                    ProposalId = s.ProposalId,
                    FeatureName = s.FeatureName,
                    Decision = s.Decision.ToString(),
                    DecidedRole = s.DecidedRole.ToString(),
                })];
        }

        preview.TrailId = trail.Value.TrailId;
        preview.TrailIdentifier = trail.Value.Identifier;
        preview.TrailName = trail.Value.Name;
        preview.TrailCuratedLengthKm = trail.Value.TrailLength;
        preview.TrailIsVerified = trail.Value.IsVerified;

        if (trail.Value.GeoPath is not null)
        {
            preview.TrailCoordinates = ToCoordinates(trail.Value.GeoPath);
            preview.TrailMeasuredLengthKm = TrailLength.FromGeometry(trail.Value.GeoPath);
        }

        return Result.Ok(preview);
    }

    public async Task<Result<int>> DecideAsync(
        int sessionId, IReadOnlyCollection<int> proposalIds, string decision,
        string? trailIdentifier, string? role, string? note, ProposalOverrides? overrides,
        string decidedBy, CancellationToken ctoken)
    {
        if (proposalIds.Count == 0)
            return Result.Fail<int>(new Message((int)HttpStatusCode.BadRequest, "At least one proposal is required."));

        if (!Enum.TryParse<ProposalDecision>(decision, ignoreCase: true, out var parsedDecision)
            || !Enum.IsDefined(parsedDecision))
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest, $"Unknown decision. Use one of: {string.Join(", ", Enum.GetNames<ProposalDecision>())}."));

        var parsedRole = TrailSourceLinkRole.Segment;

        if (!string.IsNullOrWhiteSpace(role)
            && (!Enum.TryParse(role, ignoreCase: true, out parsedRole) || !Enum.IsDefined(parsedRole)))
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest, $"Unknown role. Use one of: {string.Join(", ", Enum.GetNames<TrailSourceLinkRole>())}."));

        // Exclude says the feature is never published, whatever the reviewer picked as role.
        if (parsedDecision == ProposalDecision.Exclude)
            parsedRole = TrailSourceLinkRole.Excluded;

        var name = string.IsNullOrWhiteSpace(overrides?.Name) ? null : overrides.Name.Trim();
        var lengthKm = overrides?.LengthKm;

        // The source's names are the long ones the database was deliberately weaned off, so
        // only a trail the import creates takes one. An existing name is never rewritten.
        if (name is not null && parsedDecision != ProposalDecision.CreateNew)
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest, "Only CreateNew takes a name."));

        // A length has nowhere to be written unless the feature ends up on a trail.
        if (lengthKm is not null
            && parsedDecision is not (ProposalDecision.CreateNew or ProposalDecision.Accept or ProposalDecision.Relink))
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest, "Only Accept, Relink and CreateNew take a length."));

        if (lengthKm is <= 0 or > 1000)
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest, "A length must be more than 0 and at most 1000 km."));

        var found = await _repository.GetSessionAsync(sessionId, ctoken);

        if (!found.IsSuccess)
            return SessionFailure<int>(found.Status, sessionId);

        if (found.Value.Status != ImportSessionStatus.AwaitingReview)
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.Conflict, "Only a session awaiting review can be decided."));

        int? decidedTrailId = null;

        if (parsedDecision == ProposalDecision.Relink)
        {
            if (string.IsNullOrWhiteSpace(trailIdentifier))
                return Result.Fail<int>(new Message((int)HttpStatusCode.BadRequest, "Relink needs a trail to link to."));

            var trail = await _repository.GetTrailIdByIdentifierAsync(trailIdentifier, ctoken);

            if (trail.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<int>(new Message((int)HttpStatusCode.BadRequest, $"Trail {trailIdentifier} does not exist."));

            if (!trail.IsSuccess)
                return Result.Fail<int>(new Message((int)HttpStatusCode.InternalServerError, "The trail could not be looked up."));

            decidedTrailId = trail.Value;
        }

        var check = await _repository.CheckProposalsAsync(sessionId, proposalIds, ctoken);

        if (!check.IsSuccess)
            return Result.Fail<int>(new Message((int)HttpStatusCode.InternalServerError, "The proposals could not be checked."));

        // Distinct, because a repeated id is one row and would otherwise fail the count.
        var requested = proposalIds.Distinct().Count();

        if (check.Value.Found != requested)
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest,
                $"{requested - check.Value.Found} of the proposals do not belong to session {sessionId}."));

        // Accepting a suggestion that was never made would leave the proposal approved and
        // pointing at nothing, which the apply phase could not act on.
        if (parsedDecision == ProposalDecision.Accept && check.Value.WithoutSuggestion > 0)
            return Result.Fail<int>(new Message(
                (int)HttpStatusCode.BadRequest,
                $"{check.Value.WithoutSuggestion} of the proposals have no suggested trail. Relink or create instead."));

        var decided = await _repository.SetDecisionAsync(
            sessionId, proposalIds, parsedDecision, decidedTrailId, parsedRole, note,
            new ProposalOverrides(name, lengthKm), decidedBy, ctoken);

        if (!decided.IsSuccess)
            return Result.Fail<int>(new Message((int)HttpStatusCode.InternalServerError, "The decision could not be saved."));

        _logger.LogInformation(
            "TrailImportService: {count} proposal(s) in session {sessionId} set to {decision} by {user}.",
            decided.Value, sessionId, parsedDecision, decidedBy);

        return Result.Ok(decided.Value);
    }

    public async Task<Result> DeleteSessionAsync(int sessionId, CancellationToken ctoken)
    {
        var found = await _repository.GetSessionAsync(sessionId, ctoken);

        if (!found.IsSuccess)
            return found.Status == RepositoryResultStatus.NotFound
                ? Result.Fail(new Message((int)HttpStatusCode.NotFound, $"Session {sessionId} was not found."))
                : Result.Fail(new Message((int)HttpStatusCode.InternalServerError, "The session could not be read."));

        // Deleting a session a worker is holding would leave it writing proposals to a row
        // that no longer exists.
        if (found.Value.Status is ImportSessionStatus.Analyzing or ImportSessionStatus.Applying)
            return Result.Fail(new Message((int)HttpStatusCode.Conflict, "The session is being processed and cannot be deleted."));

        var deleted = await _repository.DeleteSessionAsync(sessionId, ctoken);

        if (!deleted.IsSuccess)
            return deleted.Status == RepositoryResultStatus.NotFound
                ? Result.Fail(new Message((int)HttpStatusCode.NotFound, $"Session {sessionId} was not found."))
                : Result.Fail(new Message((int)HttpStatusCode.InternalServerError, "The session could not be deleted."));

        _fileStore.Delete(found.Value.StoredPath);

        _logger.LogInformation("TrailImportService: Session {sessionId} deleted.", sessionId);

        return Result.Ok();
    }

    private static int ClampPageSize(int pageSize) =>
        pageSize <= 0 ? DefaultPageSize : Math.Min(pageSize, MaxPageSize);

    private static bool TryParseFilter<T>(string? value, out T? parsed) where T : struct, Enum
    {
        parsed = null;

        if (string.IsNullOrWhiteSpace(value))
            return true;

        if (!Enum.TryParse<T>(value, ignoreCase: true, out var result) || !Enum.IsDefined(result))
            return false;

        parsed = result;
        return true;
    }

    private static IReadOnlyList<double[]> ToCoordinates(LineString line) =>
        line.Coordinates.Select(c => new[] { c.X, c.Y }).ToList();

    // sparlangd out of the stored properties. Read as text rather than deserialised: the
    // source writes the field in six different shapes and TrailLength.Parse expects that.
    private static string? ReadSourceLength(string? properties)
    {
        if (string.IsNullOrWhiteSpace(properties))
            return null;

        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(properties);

            return document.RootElement.TryGetProperty("sparlangd", out var value)
                ? value.ToString()
                : null;
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
        }
    }

    private static Result<T> SessionFailure<T>(RepositoryResultStatus status, int sessionId) =>
        status == RepositoryResultStatus.NotFound
            ? Result.Fail<T>(new Message((int)HttpStatusCode.NotFound, $"Session {sessionId} was not found."))
            : Result.Fail<T>(new Message((int)HttpStatusCode.InternalServerError, "The session could not be read."));

    private static TrailImportSessionResponse ToResponse(TrailImportSession session, ProposalCounts? counts) => new()
    {
        Id = session.Id,
        Identifier = session.Identifier,
        Source = session.Source,
        FileName = session.FileName,
        FileHash = session.FileHash,
        FileSizeBytes = session.FileSizeBytes,
        Status = session.Status.ToString(),
        UploadedBy = session.UploadedBy,
        CreatedAt = session.CreatedAt,
        AnalyzedAt = session.AnalyzedAt,
        AppliedAt = session.AppliedAt,
        FeatureCount = session.FeatureCount,
        ErrorMessage = session.ErrorMessage,
        Counts = counts is null ? null : new TrailImportCountsResponse
        {
            Total = counts.Total,
            Certain = counts.Certain,
            High = counts.High,
            Medium = counts.Medium,
            Unmatched = counts.Unmatched,
            Pending = counts.Pending,
            Accepted = counts.Accepted,
            Relinked = counts.Relinked,
            CreateNew = counts.CreateNew,
            Excluded = counts.Excluded,
            Skipped = counts.Skipped,
        },
    };

    private static TrailImportProposalResponse ToResponse(ProposalSummary summary) => new()
    {
        Id = summary.Id,
        ExternalId = summary.ExternalId,
        FeatureName = summary.FeatureName,
        Confidence = summary.Confidence.ToString(),
        CoverageForward = summary.CoverageForward,
        CoverageBackward = summary.CoverageBackward,
        HausdorffMeters = summary.HausdorffMetres,
        MatchReason = summary.MatchReason,
        Decision = summary.Decision.ToString(),
        DecidedRole = summary.DecidedRole.ToString(),
        SuggestedTrailId = summary.SuggestedTrailId,
        SuggestedTrailName = summary.SuggestedTrailName,
        NearestTrailId = summary.NearestTrailId,
        NearestTrailName = summary.NearestTrailName,
        DecidedTrailId = summary.DecidedTrailId,
        DecidedTrailName = summary.DecidedTrailName,
        DecidedBy = summary.DecidedBy,
        DecidedAt = summary.DecidedAt,
        Note = summary.Note,
        DecidedName = summary.DecidedName,
        DecidedLengthKm = summary.DecidedLengthKm,
    };
}
