using Core.Interfaces.Repositories;
using Core.TrailImport.Apply;
using Core.TrailImport.Matching;
using Core.TrailImport.Review;
using Infrastructure.Data.Entities;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;
using System.Net.Sockets;

namespace Core.Repositories;

public class TrailImportRepository : ITrailImportRepository
{
    // Proposals carry full geometry, so they are written a batch at a time.
    private const int ProposalBatchSize = 20;

    // The link drops connections at random, and a write killed mid-flight can leave the
    // table locked until the server's keepalives reap it. The waits are therefore measured
    // in seconds: this runs in a background job, so nobody is holding a request open.
    private static readonly IReadOnlyList<TimeSpan> RetryDelays =
    [
        TimeSpan.FromSeconds(1),
        TimeSpan.FromSeconds(5),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromSeconds(90),
    ];

    private readonly IDbContextFactory<StigViddDbContext> _dbContextFactory;
    private readonly ILogger<TrailImportRepository> _logger;

    public TrailImportRepository(IDbContextFactory<StigViddDbContext> dbContextFactory, ILogger<TrailImportRepository> logger)
    {
        _dbContextFactory = dbContextFactory;
        _logger = logger;
    }

    public async Task<RepositoryResult<TrailImportSession>> GetSessionAsync(int sessionId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var session = await context.TrailImportSessions
                .FirstOrDefaultAsync(s => s.Id == sessionId, ctoken);

            return session is null
                ? RepositoryResult<TrailImportSession>.NotFound()
                : RepositoryResult<TrailImportSession>.Success(session);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetSessionAsync -> Something went wrong when fetching session {sessionId}.", sessionId);
            return RepositoryResult<TrailImportSession>.Error();
        }
    }

    public async Task<RepositoryResult> UpdateSessionAsync(TrailImportSession session, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            session.LastUpdatedAt = DateTime.UtcNow;
            context.TrailImportSessions.Update(session);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: UpdateSessionAsync -> Something went wrong when updating session {sessionId}.", session.Id);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<TrailGeometry>>> GetTrailGeometriesAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var trails = await context.Trails
                .AsNoTracking()
                .Where(t => t.GeoPath != null)
                .Select(t => new TrailGeometry(t.Id, t.GeoPath!))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailGeometry>>.Success(trails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetTrailGeometriesAsync -> Something went wrong when fetching trail geometries.");
            return RepositoryResult<IReadOnlyCollection<TrailGeometry>>.Error();
        }
    }

    // The fingerprints a reviewer has already excluded for this source. Read before the
    // trail comparison so an excluded feature comes back decided, not offered up as new.
    public async Task<RepositoryResult<IReadOnlyCollection<string>>> GetExcludedFingerprintsAsync(string source, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var fingerprints = await context.TrailSourceLinks
                .AsNoTracking()
                .Where(l => l.Source == source && l.Role == TrailSourceLinkRole.Excluded)
                .Select(l => l.GeometryFingerprint)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<string>>.Success(fingerprints);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetExcludedFingerprintsAsync -> Something went wrong when reading excluded links for {source}.", source);
            return RepositoryResult<IReadOnlyCollection<string>>.Error();
        }
    }

    // Re-running the analysis replaces the proposals rather than adding to them, so a
    // retried session does not end up with two rows per feature. That also makes the whole
    // operation safe to simply run again, which is what the retry below relies on.
    public async Task<RepositoryResult> ReplaceProposalsAsync(int sessionId, IReadOnlyCollection<TrailImportProposal> proposals, CancellationToken ctoken)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await WriteProposalsAsync(sessionId, proposals, ctoken);

                return RepositoryResult.Success();
            }
            catch (Exception ex) when (attempt < RetryDelays.Count && IsTransient(ex))
            {
                _logger.LogWarning(ex,
                    "TrailImportRepository: ReplaceProposalsAsync -> Attempt {attempt} for session {sessionId} was cut short; retrying in {delay}.",
                    attempt + 1, sessionId, RetryDelays[attempt]);

                await WaitBeforeRetryAsync(attempt, ctoken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TrailImportRepository: ReplaceProposalsAsync -> Something went wrong when saving proposals for session {sessionId}.", sessionId);
                return RepositoryResult.Error();
            }
        }
    }

    private async Task WriteProposalsAsync(int sessionId, IReadOnlyCollection<TrailImportProposal> proposals, CancellationToken ctoken)
    {
        using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

        // The delete and the inserts are one replacement: a dropped connection leaves
        // the session's proposals as they were, not half rewritten.
        await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

        await context.TrailImportProposals
            .Where(p => p.SessionId == sessionId)
            .ExecuteDeleteAsync(ctoken);

        foreach (var proposal in proposals)
        {
            proposal.SessionId = sessionId;

            // An earlier attempt may have had keys handed back before its transaction rolled
            // back. Those ids no longer exist, so they must not be reused as insert values.
            proposal.Id = 0;
        }

        foreach (var batch in proposals.Chunk(ProposalBatchSize))
        {
            await context.TrailImportProposals.AddRangeAsync(batch, ctoken);
            await context.SaveChangesAsync(ctoken);

            // Saved rows are not needed again, and tracking them all slows every later batch.
            context.ChangeTracker.Clear();
        }

        await transaction.CommitAsync(ctoken);
    }

    /// <summary>Overridable so tests exercise the retry without waiting for it.</summary>
    protected virtual Task WaitBeforeRetryAsync(int attempt, CancellationToken ctoken) =>
        Task.Delay(RetryDelays[attempt], ctoken);

    // A dropped connection or a stalled read, anywhere in the chain. Deliberately not
    // matched on Npgsql types: the repository stays provider-agnostic, and this is the
    // shape every transport failure arrives in.
    private static bool IsTransient(Exception ex) =>
        ex is TimeoutException or SocketException or IOException
        || (ex.InnerException is not null && IsTransient(ex.InnerException));

    // A session is only Analyzing while a worker holds it, so a row still in that state at
    // startup belongs to a run a restart cut short.
    public async Task<RepositoryResult<int>> FailInterruptedSessionsAsync(string message, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var failed = await context.TrailImportSessions
                .Where(s => s.Status == ImportSessionStatus.Analyzing)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Status, ImportSessionStatus.Failed)
                    .SetProperty(x => x.ErrorMessage, message)
                    .SetProperty(x => x.LastUpdatedAt, DateTime.UtcNow), ctoken);

            return RepositoryResult<int>.Success(failed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: FailInterruptedSessionsAsync -> Something went wrong when marking interrupted sessions.");
            return RepositoryResult<int>.Error();
        }
    }

    public async Task<RepositoryResult<TrailImportSession>> AddSessionAsync(TrailImportSession session, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            context.TrailImportSessions.Add(session);
            await context.SaveChangesAsync(ctoken);

            return RepositoryResult<TrailImportSession>.Success(session);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: AddSessionAsync -> Something went wrong when creating a session for {fileName}.", session.FileName);
            return RepositoryResult<TrailImportSession>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<TrailImportSession>>> GetSessionsAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var sessions = await context.TrailImportSessions
                .AsNoTracking()
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailImportSession>>.Success(sessions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetSessionsAsync -> Something went wrong when listing sessions.");
            return RepositoryResult<IReadOnlyCollection<TrailImportSession>>.Error();
        }
    }

    // Re-uploading the same export warns rather than refuses, so this returns the earlier
    // sessions instead of blocking the new one.
    public async Task<RepositoryResult<IReadOnlyCollection<TrailImportSession>>> GetSessionsByFileHashAsync(string source, string fileHash, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var sessions = await context.TrailImportSessions
                .AsNoTracking()
                .Where(s => s.Source == source && s.FileHash == fileHash)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<TrailImportSession>>.Success(sessions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetSessionsByFileHashAsync -> Something went wrong when looking for earlier uploads.");
            return RepositoryResult<IReadOnlyCollection<TrailImportSession>>.Error();
        }
    }

    public async Task<RepositoryResult> DeleteSessionAsync(int sessionId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // The proposals go with it through the cascade on the relationship.
            var deleted = await context.TrailImportSessions
                .Where(s => s.Id == sessionId)
                .ExecuteDeleteAsync(ctoken);

            return deleted == 0 ? RepositoryResult.NotFound() : RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: DeleteSessionAsync -> Something went wrong when deleting session {sessionId}.", sessionId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult<ApplyPlan>> GetApplyPlanAsync(
        int sessionId, string source, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Accept keeps the suggestion, Relink points somewhere else, and every other
            // decision writes no trail at all.
            var rows = await context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId)
                .Select(p => new
                {
                    p.Id,
                    p.FeatureName,
                    p.ExternalId,
                    p.GeometryFingerprint,
                    p.Decision,
                    p.DecidedRole,
                    p.Confidence,
                    p.CoverageForward,
                    p.DecidedName,
                    p.DecidedLengthKm,
                    TargetTrailId =
                        p.Decision == ProposalDecision.Accept ? p.SuggestedTrailId
                        : p.Decision == ProposalDecision.Relink ? p.DecidedTrailId
                        : null,
                })
                .ToListAsync(ctoken);

            var targetIds = rows.Where(r => r.TargetTrailId != null)
                .Select(r => r.TargetTrailId!.Value).Distinct().ToList();

            var names = await context.Trails.AsNoTracking()
                .Where(t => targetIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Name })
                .ToDictionaryAsync(t => t.Id, t => t.Name, ctoken);

            // Links already on file for this source, which is what gives a trail a baseline.
            var existing = await context.TrailSourceLinks.AsNoTracking()
                .Where(l => l.Source == source && l.TrailId != null)
                .Select(l => new { TrailId = l.TrailId!.Value, l.Role })
                .ToListAsync(ctoken);

            var plan = new ApplyPlan(
                rows.Select(r => new ApplyPlanRow(
                    r.Id,
                    r.FeatureName,
                    r.ExternalId,
                    r.GeometryFingerprint,
                    r.Decision,
                    r.DecidedRole,
                    r.Confidence,
                    r.CoverageForward,
                    r.TargetTrailId,
                    r.TargetTrailId != null && names.TryGetValue(r.TargetTrailId.Value, out var name) ? name : null,
                    r.DecidedName,
                    r.DecidedLengthKm)).ToList(),
                existing.Where(l => l.Role == TrailSourceLinkRole.Segment)
                    .Select(l => l.TrailId).ToHashSet(),
                existing.Select(l => l.TrailId).ToHashSet());

            return RepositoryResult<ApplyPlan>.Success(plan);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetApplyPlanAsync -> Something went wrong when reading the apply plan for session {sessionId}.", sessionId);
            return RepositoryResult<ApplyPlan>.Error();
        }
    }

    // Decisions a new analysis would throw away. An exclusion the analysis carries forward
    // from an applied link is not one of them: it comes back on its own, so counting it
    // would warn about work that is not at risk.
    public async Task<RepositoryResult<int>> GetDiscardableDecisionCountAsync(
        int sessionId, string source, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var carriedForward = context.TrailSourceLinks
                .Where(l => l.Source == source && l.Role == TrailSourceLinkRole.Excluded)
                .Select(l => l.GeometryFingerprint);

            var count = await context.TrailImportProposals
                .Where(p => p.SessionId == sessionId
                    && p.Decision != ProposalDecision.Pending
                    && !(p.Decision == ProposalDecision.Exclude && carriedForward.Contains(p.GeometryFingerprint)))
                .CountAsync(ctoken);

            return RepositoryResult<int>.Success(count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetDiscardableDecisionCountAsync -> Something went wrong when counting decisions for session {sessionId}.", sessionId);
            return RepositoryResult<int>.Error();
        }
    }

    // The same rows as GetApplyPlanAsync plus the geometry and properties, which is the
    // expensive half. Read only when a session is actually being applied.
    public async Task<RepositoryResult<ApplyInput>> GetApplyInputAsync(
        int sessionId, string source, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var features = await context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId)
                .Select(p => new ApplyFeature(
                    p.Id,
                    p.ExternalId,
                    p.FeatureName,
                    p.GeometryFingerprint,
                    p.FeatureProperties,
                    p.FeatureGeometry,
                    p.Decision,
                    p.DecidedRole,
                    p.Confidence,
                    p.Decision == ProposalDecision.Accept ? p.SuggestedTrailId
                        : p.Decision == ProposalDecision.Relink ? p.DecidedTrailId
                        : null,
                    p.DecidedName,
                    p.DecidedLengthKm))
                .ToListAsync(ctoken);

            var targetIds = features.Where(f => f.TargetTrailId != null)
                .Select(f => f.TargetTrailId!.Value).Distinct().ToList();

            var targets = await context.Trails.AsNoTracking()
                .Where(t => targetIds.Contains(t.Id))
                .Select(t => new ApplyTarget(
                    t.Id, t.Name, t.Classification, t.Accessibility, t.AccessibilityInfo, t.TrailSymbol, t.GeoPath))
                .ToDictionaryAsync(t => t.TrailId, ctoken);

            var links = await context.TrailSourceLinks.AsNoTracking()
                .Where(l => l.Source == source)
                .Select(l => new { l.GeometryFingerprint, Baseline = new ApplyBaseline(l.Id, l.TrailId, l.SourceSnapshot) })
                .ToListAsync(ctoken);

            var input = new ApplyInput(
                features,
                targets,
                links.ToDictionary(l => l.GeometryFingerprint, l => l.Baseline, StringComparer.Ordinal),
                links.Where(l => l.Baseline.TrailId != null)
                    .Select(l => l.Baseline.TrailId!.Value).ToHashSet());

            return RepositoryResult<ApplyInput>.Success(input);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetApplyInputAsync -> Something went wrong when reading session {sessionId} for apply.", sessionId);
            return RepositoryResult<ApplyInput>.Error();
        }
    }

    // The one destructive method in the sync. Everything it writes is decided before it is
    // called, so all it owns is the transaction and the order the writes go in.
    public async Task<RepositoryResult<IReadOnlyDictionary<int, int>>> ApplySessionAsync(
        int sessionId, ApplyWriteSet writes, string report, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var session = await context.TrailImportSessions
                .FirstOrDefaultAsync(s => s.Id == sessionId, ctoken);

            if (session is null)
                return RepositoryResult<IReadOnlyDictionary<int, int>>.NotFound();

            // Re-read inside the transaction: the status the service checked could have
            // been taken by another apply between the two calls.
            if (session.Status != ImportSessionStatus.AwaitingReview)
                return RepositoryResult<IReadOnlyDictionary<int, int>>.Conflict();

            var created = await CreateTrailsAsync(context, session.Source, writes.Creates, ctoken);

            await UpdateTrailsAsync(context, writes.Updates, ctoken);
            await WriteLinksAsync(context, session.Source, writes.Links, created, ctoken);

            session.Status = ImportSessionStatus.Applied;
            session.AppliedAt = DateTime.UtcNow;
            session.ApplyReport = report;
            session.LastUpdatedAt = DateTime.UtcNow;

            await context.SaveChangesAsync(ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult<IReadOnlyDictionary<int, int>>.Success(created);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: ApplySessionAsync -> Something went wrong when applying session {sessionId}.", sessionId);
            return RepositoryResult<IReadOnlyDictionary<int, int>>.Error();
        }
    }

    private static async Task<Dictionary<int, int>> CreateTrailsAsync(
        StigViddDbContext context, string source, IReadOnlyList<TrailCreate> creates, CancellationToken ctoken)
    {
        var created = new Dictionary<int, int>();

        if (creates.Count == 0)
            return created;

        foreach (var create in creates)
        {
            var trail = new Trail
            {
                Name = create.Name,
                TrailLength = create.TrailLength,
                GeoPath = create.Geometry,
                Classification = create.Classification,
                Accessibility = create.Accessibility,
                AccessibilityInfo = create.AccessibilityInfo,
                TrailSymbol = create.TrailSymbol,
                CreatedBy = source,

                // An imported trail is not published until someone has looked at it: the app
                // only lists trails that are verified and carry a route.
                IsVerified = false,
            };

            context.Trails.Add(trail);

            // Saved one at a time so the new id is known before the proposal records it.
            await context.SaveChangesAsync(ctoken);

            created[create.ProposalId] = trail.Id;
        }

        var proposalIds = created.Keys.ToList();

        // The proposal is the record of what a decision produced, so the new id goes back
        // onto the row that caused it.
        var proposals = await context.TrailImportProposals
            .Where(p => proposalIds.Contains(p.Id))
            .ToListAsync(ctoken);

        foreach (var proposal in proposals)
            proposal.CreatedTrailId = created[proposal.Id];

        return created;
    }

    private static async Task UpdateTrailsAsync(
        StigViddDbContext context, IReadOnlyList<TrailUpdate> updates, CancellationToken ctoken)
    {
        if (updates.Count == 0)
            return;

        var ids = updates.Select(u => u.TrailId).ToList();

        var trails = await context.Trails
            .Where(t => ids.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, ctoken);

        foreach (var update in updates)
        {
            if (!trails.TryGetValue(update.TrailId, out var trail))
                continue;

            // Null means the merge left the field alone, which is not the same as clearing it.
            trail.TrailLength = update.TrailLength ?? trail.TrailLength;
            trail.Classification = update.Classification ?? trail.Classification;
            trail.Accessibility = update.Accessibility ?? trail.Accessibility;
            trail.AccessibilityInfo = update.AccessibilityInfo ?? trail.AccessibilityInfo;
            trail.TrailSymbol = update.TrailSymbol ?? trail.TrailSymbol;
            trail.GeoPath = update.GeoPath ?? trail.GeoPath;
            trail.LastUpdatedAt = DateTime.UtcNow;
        }
    }

    private static async Task WriteLinksAsync(
        StigViddDbContext context, string source, IReadOnlyList<LinkWrite> links,
        IReadOnlyDictionary<int, int> created, CancellationToken ctoken)
    {
        if (links.Count == 0)
            return;

        var ids = links.Where(l => l.LinkId != null).Select(l => l.LinkId!.Value).ToList();

        var existing = await context.TrailSourceLinks
            .Where(l => ids.Contains(l.Id))
            .ToDictionaryAsync(l => l.Id, ctoken);

        var seenAt = DateTime.UtcNow;

        foreach (var write in links)
        {
            // A feature whose trail this apply just created carries the create's id rather
            // than a trail id, because there was none to carry when the write was planned.
            var trailId = write.CreatedForProposalId is int proposalId
                ? created.TryGetValue(proposalId, out var newId) ? newId : null
                : write.TrailId;

            if (write.LinkId is int linkId && existing.TryGetValue(linkId, out var link))
            {
                link.TrailId = trailId;
                link.Role = write.Role;
                link.Confidence = write.Confidence;
                link.LastSeenExternalId = write.ExternalId;
                link.SourceSnapshot = write.SourceSnapshot;
                link.ConfirmedByHuman = write.ConfirmedByHuman;
                link.LastSeenAt = seenAt;
                link.LastUpdatedAt = seenAt;
                continue;
            }

            context.TrailSourceLinks.Add(new TrailSourceLink
            {
                Source = source,
                GeometryFingerprint = write.GeometryFingerprint,
                LastSeenExternalId = write.ExternalId,
                TrailId = trailId,
                Role = write.Role,
                Confidence = write.Confidence,
                SourceSnapshot = write.SourceSnapshot,
                ConfirmedByHuman = write.ConfirmedByHuman,
                LastSeenAt = seenAt,
            });
        }
    }

    public async Task<RepositoryResult<ProposalCounts>> GetProposalCountsAsync(int sessionId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            // Two grouped reads instead of eleven counts, and neither touches the geometry.
            var byConfidence = await context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId)
                .GroupBy(p => p.Confidence)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync(ctoken);

            var byDecision = await context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId)
                .GroupBy(p => p.Decision)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync(ctoken);

            int Confidence(MatchConfidence key) => byConfidence.FirstOrDefault(x => x.Key == key)?.Count ?? 0;
            int Decision(ProposalDecision key) => byDecision.FirstOrDefault(x => x.Key == key)?.Count ?? 0;

            return RepositoryResult<ProposalCounts>.Success(new ProposalCounts(
                byConfidence.Sum(x => x.Count),
                Confidence(MatchConfidence.Certain),
                Confidence(MatchConfidence.High),
                Confidence(MatchConfidence.Medium),
                Confidence(MatchConfidence.Unmatched),
                Decision(ProposalDecision.Pending),
                Decision(ProposalDecision.Accept),
                Decision(ProposalDecision.Relink),
                Decision(ProposalDecision.CreateNew),
                Decision(ProposalDecision.Exclude),
                Decision(ProposalDecision.Skip)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetProposalCountsAsync -> Something went wrong when counting proposals for session {sessionId}.", sessionId);
            return RepositoryResult<ProposalCounts>.Error();
        }
    }

    public async Task<RepositoryResult<PagedResult<ProposalSummary>>> GetProposalsAsync(
        int sessionId, MatchConfidence? confidence, ProposalDecision? decision, int page, int pageSize, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var query = context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId);

            if (confidence.HasValue)
                query = query.Where(p => p.Confidence == confidence.Value);

            if (decision.HasValue)
                query = query.Where(p => p.Decision == decision.Value);

            var total = await query.CountAsync(ctoken);

            // Lowest confidence first: the features that need a human come before the ones
            // that matched themselves. Alphabetical within a tier, which is what the list
            // shows once a confidence filter is on.
            var ordered = SwedishCollation(context) is { } collation
                ? query.OrderBy(p => p.Confidence).ThenBy(p => EF.Functions.Collate(p.FeatureName, collation))
                : query.OrderBy(p => p.Confidence).ThenBy(p => p.FeatureName);

            var items = await ordered
                .ThenBy(p => p.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new ProposalSummary(
                    p.Id,
                    p.ExternalId,
                    p.FeatureName,
                    p.Confidence,
                    p.CoverageForward,
                    p.CoverageBackward,
                    p.HausdorffMeters,
                    p.MatchReason,
                    p.Decision,
                    p.DecidedRole,
                    p.SuggestedTrailId,
                    context.Trails.Where(t => t.Id == p.SuggestedTrailId).Select(t => t.Name).FirstOrDefault(),
                    p.NearestTrailId,
                    context.Trails.Where(t => t.Id == p.NearestTrailId).Select(t => t.Name).FirstOrDefault(),
                    p.DecidedTrailId,
                    context.Trails.Where(t => t.Id == p.DecidedTrailId).Select(t => t.Name).FirstOrDefault(),
                    p.DecidedBy,
                    p.DecidedAt,
                    p.Note,
                    p.DecidedName,
                    p.DecidedLengthKm))
                .ToListAsync(ctoken);

            return RepositoryResult<PagedResult<ProposalSummary>>.Success(
                new PagedResult<ProposalSummary>(items, page, page * pageSize < total, total));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetProposalsAsync -> Something went wrong when listing proposals for session {sessionId}.", sessionId);
            return RepositoryResult<PagedResult<ProposalSummary>>.Error();
        }
    }

    // The database is en_US.UTF-8, which sorts Älmås between Alfa and Åsa rather than after
    // Zeta. Reviewers read Swedish trail names, so the list asks for a Swedish collation —
    // on Postgres only, since the integration tests run on SQLite, which has no such thing.
    private const string SwedishIcuCollation = "sv-SE-x-icu";
    private const string NpgsqlProvider = "Npgsql.EntityFrameworkCore.PostgreSQL";

    private static string? SwedishCollation(StigViddDbContext context) =>
        context.Database.ProviderName == NpgsqlProvider ? SwedishIcuCollation : null;

    // The only read that carries FeatureGeometry, because the preview is the only caller
    // that draws it.
    public async Task<RepositoryResult<TrailImportProposal>> GetProposalAsync(int sessionId, int proposalId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var proposal = await context.TrailImportProposals
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == proposalId && p.SessionId == sessionId, ctoken);

            return proposal is null
                ? RepositoryResult<TrailImportProposal>.NotFound()
                : RepositoryResult<TrailImportProposal>.Success(proposal);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetProposalAsync -> Something went wrong when fetching proposal {proposalId}.", proposalId);
            return RepositoryResult<TrailImportProposal>.Error();
        }
    }

    // CreateNew and Exclude aim at no trail at all, so they are not competing for this one.
    public async Task<RepositoryResult<IReadOnlyList<T>>> GetSiblingsOnTrailAsync<T>(
        int sessionId, int proposalId, int trailId,
        Expression<Func<TrailImportProposal, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var siblings = await context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId
                    && p.Id != proposalId
                    && (p.DecidedTrailId ?? p.SuggestedTrailId) == trailId
                    && p.Decision != ProposalDecision.CreateNew
                    && p.Decision != ProposalDecision.Exclude)
                .OrderBy(p => p.Id)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<T>>.Success(siblings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetSiblingsOnTrailAsync -> Something went wrong when reading the other proposals on trail {trailId}.", trailId);
            return RepositoryResult<IReadOnlyList<T>>.Error();
        }
    }

    public async Task<RepositoryResult<TrailForReview>> GetTrailForReviewAsync(int trailId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var trail = await context.Trails
                .AsNoTracking()
                .Where(t => t.Id == trailId)
                .Select(t => new TrailForReview(t.Id, t.Identifier, t.Name, t.TrailLength, t.IsVerified, t.GeoPath))
                .FirstOrDefaultAsync(ctoken);

            return trail is null
                ? RepositoryResult<TrailForReview>.NotFound()
                : RepositoryResult<TrailForReview>.Success(trail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetTrailForReviewAsync -> Something went wrong when fetching trail {trailId}.", trailId);
            return RepositoryResult<TrailForReview>.Error();
        }
    }

    // Callers name a trail the way the rest of the API does, by identifier. The proposal
    // stores the numeric id, so the two are joined here rather than out in the client.
    public async Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var id = await context.Trails
                .AsNoTracking()
                .Where(t => t.Identifier == identifier)
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync(ctoken);

            return id is null ? RepositoryResult<int>.NotFound() : RepositoryResult<int>.Success(id.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: GetTrailIdByIdentifierAsync -> Something went wrong when looking up trail {identifier}.", identifier);
            return RepositoryResult<int>.Error();
        }
    }

    // One query answers both questions a batch decision has to ask: do these ids belong to
    // this session, and can they be accepted at all.
    public async Task<RepositoryResult<ProposalIdCheck>> CheckProposalsAsync(int sessionId, IReadOnlyCollection<int> proposalIds, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var check = await context.TrailImportProposals
                .AsNoTracking()
                .Where(p => p.SessionId == sessionId && proposalIds.Contains(p.Id))
                .GroupBy(p => 1)
                .Select(g => new ProposalIdCheck(g.Count(), g.Count(p => p.SuggestedTrailId == null)))
                .FirstOrDefaultAsync(ctoken);

            return RepositoryResult<ProposalIdCheck>.Success(check ?? new ProposalIdCheck(0, 0));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: CheckProposalsAsync -> Something went wrong when checking proposals in session {sessionId}.", sessionId);
            return RepositoryResult<ProposalIdCheck>.Error();
        }
    }

    // Accept means the suggestion was right, so the decided trail is copied from the
    // suggestion row by row rather than passed in by the caller.
    public async Task<RepositoryResult<int>> SetDecisionAsync(
        int sessionId, IReadOnlyCollection<int> proposalIds, ProposalDecision decision,
        int? decidedTrailId, TrailSourceLinkRole role, string? note, ProposalOverrides? overrides,
        string decidedBy, CancellationToken ctoken)
    {
        try
        {
            using var context = await _dbContextFactory.CreateDbContextAsync(ctoken);

            var useSuggested = decision == ProposalDecision.Accept;

            // Pending is the undo. The row goes back to how the analysis left it rather than
            // keeping a reviewer's name on a decision that no longer exists.
            var undone = decision == ProposalDecision.Pending;
            var decidedAt = DateTime.UtcNow;

            // A decision states the reviewer's overrides in full, so leaving them out is
            // how they are taken back off again.
            var decidedName = undone ? null : overrides?.Name;
            var decidedLengthKm = undone ? null : overrides?.LengthKm;

            var updated = await context.TrailImportProposals
                .Where(p => p.SessionId == sessionId && proposalIds.Contains(p.Id))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Decision, decision)
                    .SetProperty(p => p.DecidedTrailId, p => useSuggested ? p.SuggestedTrailId : decidedTrailId)
                    .SetProperty(p => p.DecidedRole, undone ? TrailSourceLinkRole.Segment : role)
                    .SetProperty(p => p.DecidedBy, undone ? null : decidedBy)
                    .SetProperty(p => p.DecidedAt, undone ? (DateTime?)null : decidedAt)
                    .SetProperty(p => p.Note, undone ? null : note)
                    .SetProperty(p => p.DecidedName, decidedName)
                    .SetProperty(p => p.DecidedLengthKm, decidedLengthKm)
                    .SetProperty(p => p.LastUpdatedAt, decidedAt), ctoken);

            return RepositoryResult<int>.Success(updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TrailImportRepository: SetDecisionAsync -> Something went wrong when deciding proposals in session {sessionId}.", sessionId);
            return RepositoryResult<int>.Error();
        }
    }
}
