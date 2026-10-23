// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.HikeSubmission;
using WebDataContracts.ResponseModels.HikeSubmission;

namespace Core.Interfaces.Services;

public interface IHikeSubmissionService
{
    Task<Result<HikeSubmissionResponse>> CreateAsync(CreateHikeSubmissionRequest request, string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<HikeSubmissionResponse>>> GetMineAsync(string userIdentifier, CancellationToken ctoken);
    Task<Result> WithdrawAsync(string identifier, string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<AdminHikeSubmissionListItemResponse>>> ListForAdminAsync(string? status, CancellationToken ctoken);
    Task<Result<AdminHikeSubmissionResponse>> GetForAdminAsync(string identifier, CancellationToken ctoken);
    Task<Result<AdminHikeSubmissionResponse>> UpdateAsync(string identifier, UpdateHikeSubmissionRequest request, CancellationToken ctoken);
    Task<Result<AdminHikeSubmissionResponse>> UpdateGeometryAsync(string identifier, UpdateHikeSubmissionGeometryRequest request, CancellationToken ctoken);
    Task<Result> DeleteImageAsync(string identifier, string imageIdentifier, CancellationToken ctoken);
    Task<Result<string>> ApproveAsync(string identifier, string decidedBy, CancellationToken ctoken);
    Task<Result> RejectAsync(string identifier, RejectHikeSubmissionRequest request, string decidedBy, CancellationToken ctoken);
    Task<Result> HandleUserDeleteAsync(int userId, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<SimilarTrailResponse>>> GetSimilarRoutesAsync(string identifier, CancellationToken ctoken);
}
