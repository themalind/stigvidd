// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IHikeSubmissionRepository
{
    Task<RepositoryResult<HikeSubmission>> AddAsync(HikeSubmission submission, CancellationToken ctoken);
    Task<RepositoryResult<bool>> HasPendingForHikeAsync(int hikeId, CancellationToken ctoken);
    Task<RepositoryResult<int>> GetConsentTextIdAsync(string version, string locale, CancellationToken ctoken);
    Task<RepositoryResult<T>> GetByIdentifierAsync<T>(string identifier, Expression<Func<HikeSubmission, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetByUserIdAsync<T>(int userId, Expression<Func<HikeSubmission, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetByStatusAsync<T>(HikeSubmissionStatus? status, Expression<Func<HikeSubmission, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> UpdateDetailsAsync(string identifier, string name, string description, int classification, string parking, string gettingThere, string publicTransport, CancellationToken ctoken);
    Task<RepositoryResult> UpdateGeometryAsync(string identifier, LineString path, decimal lengthKm, double longestGapMetres, CancellationToken ctoken);
    Task<RepositoryResult<string>> DeleteImageAsync(string identifier, string imageIdentifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<string>>> RejectAsync(string identifier, string reason, string decidedBy, CancellationToken ctoken);
    Task<RepositoryResult<ApprovedSubmission>> ApproveAsync(string identifier, string decidedBy, IReadOnlyCollection<string> placeholderImagePaths, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<string>>> WithdrawAsync(string identifier, int userId, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<string>>> DeleteByUserIdAsync(int userId, CancellationToken ctoken);
}

// keep-comment: DiscardedImageUrls are copies whose hike photo was hidden by moderation; their files are the caller's to delete
public record ApprovedSubmission(string TrailIdentifier, IReadOnlyCollection<string> DiscardedImageUrls);
