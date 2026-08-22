using Core.Common;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Interfaces.Repositories;

public interface ITrailImportRepository
{
    Task<RepositoryResult<TrailImportSession>> GetSessionAsync(int sessionId, CancellationToken ctoken);
    Task<RepositoryResult> UpdateSessionAsync(TrailImportSession session, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailGeometry>>> GetTrailGeometriesAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<string>>> GetExcludedFingerprintsAsync(string source, CancellationToken ctoken);
    Task<RepositoryResult> ReplaceProposalsAsync(int sessionId, IReadOnlyCollection<TrailImportProposal> proposals, CancellationToken ctoken);
    Task<RepositoryResult<int>> FailInterruptedSessionsAsync(string message, CancellationToken ctoken);

    Task<RepositoryResult<TrailImportSession>> AddSessionAsync(TrailImportSession session, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailImportSession>>> GetSessionsAsync(CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<TrailImportSession>>> GetSessionsByFileHashAsync(string source, string fileHash, CancellationToken ctoken);
    Task<RepositoryResult> DeleteSessionAsync(int sessionId, CancellationToken ctoken);

    Task<RepositoryResult<ProposalCounts>> GetProposalCountsAsync(int sessionId, CancellationToken ctoken);
    Task<RepositoryResult<PagedResult<ProposalSummary>>> GetProposalsAsync(
        int sessionId, MatchConfidence? confidence, ProposalDecision? decision, int page, int pageSize, CancellationToken ctoken);
    Task<RepositoryResult<TrailImportProposal>> GetProposalAsync(int sessionId, int proposalId, CancellationToken ctoken);

    Task<RepositoryResult<TrailForReview>> GetTrailForReviewAsync(int trailId, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyList<ProposalSibling>>> GetSiblingsOnTrailAsync(
        int sessionId, int proposalId, int trailId, CancellationToken ctoken);
    Task<RepositoryResult<int>> GetTrailIdByIdentifierAsync(string identifier, CancellationToken ctoken);
    Task<RepositoryResult<ProposalIdCheck>> CheckProposalsAsync(int sessionId, IReadOnlyCollection<int> proposalIds, CancellationToken ctoken);
    Task<RepositoryResult<int>> SetDecisionAsync(
        int sessionId, IReadOnlyCollection<int> proposalIds, ProposalDecision decision,
        int? decidedTrailId, TrailSourceLinkRole role, string? note, ProposalOverrides? overrides,
        string decidedBy, CancellationToken ctoken);
}
