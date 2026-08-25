using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.TrailImport.Matching;
using Core.TrailImport.Source;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging;

namespace Core.Services;

// Turns an uploaded source file into one proposal per feature. Reads nothing but the file,
// the trail geometries and the excluded links, and writes nothing but the session and its
// proposals, so a run can be repeated or abandoned without leaving anything half done.
public class TrailImportAnalysisService : ITrailImportAnalysisService
{
    // What the reviewer is told when a restart cut an analysis short.
    private const string InterruptedMessage = "The analysis was interrupted by a restart. Run it again.";

    // Stamped on the proposals the analysis decides by itself, so the review list does not
    // put a reviewer name on a row nobody opened this session.
    private const string ExcludedBy = "an earlier import";

    private readonly ITrailImportRepository _repository;
    private readonly ILogger<TrailImportAnalysisService> _logger;

    public TrailImportAnalysisService(ITrailImportRepository repository, ILogger<TrailImportAnalysisService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task AnalyzeAsync(int sessionId, CancellationToken ctoken)
    {
        var found = await _repository.GetSessionAsync(sessionId, ctoken);

        if (!found.IsSuccess)
        {
            _logger.LogWarning("TrailImportAnalysisService: Session {sessionId} could not be read; nothing analysed.", sessionId);
            return;
        }

        var session = found.Value;

        try
        {
            session.Status = ImportSessionStatus.Analyzing;
            await _repository.UpdateSessionAsync(session, ctoken);

            var proposals = await BuildProposalsAsync(session, ctoken);

            var saved = await _repository.ReplaceProposalsAsync(session.Id, proposals, ctoken);

            if (!saved.IsSuccess)
            {
                await FailAsync(session, "The proposals could not be saved.", ctoken);
                return;
            }

            session.FeatureCount = proposals.Count;
            session.AnalyzedAt = DateTime.UtcNow;
            session.ErrorMessage = null;
            session.Status = ImportSessionStatus.AwaitingReview;

            await _repository.UpdateSessionAsync(session, ctoken);

            _logger.LogInformation(
                "TrailImportAnalysisService: Session {sessionId} analysed. {count} features, {certain} certain, {review} for review, {excluded} excluded before.",
                session.Id, proposals.Count,
                proposals.Count(p => p.Confidence == MatchConfidence.Certain),
                proposals.Count(p => p.Confidence < MatchConfidence.High && p.Decision == ProposalDecision.Pending),
                proposals.Count(p => p.Decision == ProposalDecision.Exclude));
        }
        catch (OperationCanceledException) when (ctoken.IsCancellationRequested)
        {
            // Shutting down. The session stays Analyzing and is marked failed at next startup.
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportAnalysisService: Session {sessionId} failed during analysis.", session.Id);
            await FailAsync(session, ex.Message, CancellationToken.None);
        }
    }

    // Clears sessions the previous run left mid-analysis. They are marked, not retried, so
    // the review view stops waiting on a run that no longer exists.
    public async Task FailInterruptedSessionsAsync(CancellationToken ctoken)
    {
        var result = await _repository.FailInterruptedSessionsAsync(InterruptedMessage, ctoken);

        if (!result.IsSuccess)
        {
            _logger.LogWarning("TrailImportAnalysisService: Interrupted sessions could not be marked.");
            return;
        }

        if (result.Value > 0)
            _logger.LogInformation("TrailImportAnalysisService: {count} interrupted session(s) marked as failed.", result.Value);
    }

    private async Task<IReadOnlyCollection<TrailImportProposal>> BuildProposalsAsync(TrailImportSession session, CancellationToken ctoken)
    {
        using var file = File.OpenRead(session.StoredPath);
        var features = SourceFeatureReader.Read(file);

        var geometries = await _repository.GetTrailGeometriesAsync(ctoken);

        if (!geometries.IsSuccess)
            throw new InvalidOperationException("The trail geometries could not be read.");

        var excluded = await _repository.GetExcludedFingerprintsAsync(session.Source, ctoken);

        if (!excluded.IsSuccess)
            throw new InvalidOperationException("The excluded source links could not be read.");

        var excludedFingerprints = excluded.Value.ToHashSet(StringComparer.Ordinal);

        // Fingerprints are computed once for the whole run, not once per feature.
        var candidates = geometries.Value
            .Select(t => new TrailCandidate(t.TrailId, GeometryFingerprint.Compute(t.Geometry), t.Geometry))
            .ToList();

        var proposals = new List<TrailImportProposal>(features.Count);

        foreach (var feature in features)
        {
            ctoken.ThrowIfCancellationRequested();

            var fingerprint = GeometryFingerprint.Compute(feature.Geometry);

            proposals.Add(excludedFingerprints.Contains(fingerprint)
                ? AlreadyExcluded(feature, fingerprint)
                : FromMatch(feature, TrailMatcher.Match(feature.Geometry, fingerprint, candidates)));
        }

        return proposals;
    }

    private static TrailImportProposal FromMatch(SourceFeature feature, TrailMatch match) => new()
    {
        ExternalId = feature.ExternalId,
        FeatureName = feature.Name,
        GeometryFingerprint = match.FeatureFingerprint,
        FeatureProperties = feature.Properties,
        FeatureGeometry = feature.Geometry,
        SuggestedTrailId = match.TrailId,
        NearestTrailId = match.NearestTrailId,
        Confidence = match.Confidence,
        CoverageForward = match.CoverageForward,
        CoverageBackward = match.CoverageBackward,
        HausdorffMeters = match.HausdorffMetres,
        MatchReason = match.Reason,
        Decision = ProposalDecision.Pending,
    };

    // A feature a reviewer has already excluded comes back decided rather than as an empty
    // row. No trail is compared: an excluded feature has none, and the point is that the
    // decision survives every later export of the same geometry.
    private static TrailImportProposal AlreadyExcluded(SourceFeature feature, string fingerprint) => new()
    {
        ExternalId = feature.ExternalId,
        FeatureName = feature.Name,
        GeometryFingerprint = fingerprint,
        FeatureProperties = feature.Properties,
        FeatureGeometry = feature.Geometry,
        Confidence = MatchConfidence.Unmatched,
        MatchReason = "excluded in an earlier import",
        Decision = ProposalDecision.Exclude,
        DecidedRole = TrailSourceLinkRole.Excluded,
        DecidedBy = ExcludedBy,
        DecidedAt = DateTime.UtcNow,
    };

    private async Task FailAsync(TrailImportSession session, string message, CancellationToken ctoken)
    {
        session.Status = ImportSessionStatus.Failed;
        session.ErrorMessage = message;

        await _repository.UpdateSessionAsync(session, ctoken);
    }
}
