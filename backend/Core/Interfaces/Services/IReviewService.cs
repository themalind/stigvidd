// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Http;
using WebDataContracts.ResponseModels.Review;

namespace Core.Interfaces.Services;

public interface IReviewService
{
    Task<Result<PagedReviewResponse>> GetReviewsByTrailIdentifierAsync(string trailIdentifier, int page, int limit, CancellationToken ctoken);
    Task<Result<ReviewResponse?>> AddReviewAsync(string UserIdentifier, string trailIdentifier, string? trailReview, decimal rating, IFormFileCollection? imageUrls, CancellationToken ctoken);
    Task<Result> DeleteReviewAsync(string reviewIdentifier, string userIdentifer, CancellationToken ctoken);
    Task<Result<bool>> HasUserReviewedTrailAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken);
    Task<Result> AnonymizeUserReviewsOnUserDeleteAsync(int userId, CancellationToken ctoken);

}
