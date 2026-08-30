// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Review;
using WebDataContracts.ResponseModels.TrailImport;

namespace Core.Interfaces.Services;

public interface ITrailImportService
{
    Task<Result<TrailImportSessionResponse>> CreateSessionAsync(
        Stream content, string fileName, string? source, string uploadedBy, CancellationToken ctoken);

    Task<Result<TrailImportSessionResponse>> QueueAnalysisAsync(int sessionId, bool force, CancellationToken ctoken);

    Task<Result<IReadOnlyCollection<TrailImportSessionResponse>>> GetSessionsAsync(CancellationToken ctoken);

    Task<Result<TrailImportSessionResponse>> GetSessionAsync(int sessionId, CancellationToken ctoken);

    Task<Result<PagedResult<TrailImportProposalResponse>>> GetProposalsAsync(
        int sessionId, string? confidence, string? decision, int page, int pageSize, CancellationToken ctoken);

    Task<Result<TrailImportPreviewResponse>> GetPreviewAsync(int sessionId, int proposalId, CancellationToken ctoken);
    Task<Result<TrailImportDiffResponse>> GetDiffAsync(int sessionId, CancellationToken ctoken);
    Task<Result<TrailImportApplyResponse>> ApplyAsync(int sessionId, CancellationToken ctoken);

    Task<Result<int>> DecideAsync(
        int sessionId, IReadOnlyCollection<int> proposalIds, string decision,
        string? trailIdentifier, string? role, string? note, ProposalOverrides? overrides,
        string decidedBy, CancellationToken ctoken);

    Task<Result> DeleteSessionAsync(int sessionId, CancellationToken ctoken);
}
