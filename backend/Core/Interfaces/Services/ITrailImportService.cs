using Core.Common;
using WebDataContracts.ResponseModels.TrailImport;

namespace Core.Interfaces.Services;

public interface ITrailImportService
{
    Task<Result<TrailImportSessionResponse>> CreateSessionAsync(
        Stream content, string fileName, string? source, string uploadedBy, CancellationToken ctoken);

    Task<Result<TrailImportSessionResponse>> QueueAnalysisAsync(int sessionId, CancellationToken ctoken);

    Task<Result<IReadOnlyCollection<TrailImportSessionResponse>>> GetSessionsAsync(CancellationToken ctoken);

    Task<Result<TrailImportSessionResponse>> GetSessionAsync(int sessionId, CancellationToken ctoken);

    Task<Result<PagedResult<TrailImportProposalResponse>>> GetProposalsAsync(
        int sessionId, string? confidence, string? decision, int page, int pageSize, CancellationToken ctoken);

    Task<Result<TrailImportPreviewResponse>> GetPreviewAsync(int sessionId, int proposalId, CancellationToken ctoken);

    Task<Result<int>> DecideAsync(
        int sessionId, IReadOnlyCollection<int> proposalIds, string decision,
        string? trailIdentifier, string? role, string? note, ProposalOverrides? overrides,
        string decidedBy, CancellationToken ctoken);

    Task<Result> DeleteSessionAsync(int sessionId, CancellationToken ctoken);
}
