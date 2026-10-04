// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public record AdminDashboardCounts(int UserCount, int NewUsers, int ReviewCount, int NewReviews);

public interface IAdminDashboardRepository
{
    Task<RepositoryResult<AdminDashboardCounts>> GetCountsAsync(DateTime since, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyCollection<T>>> GetLatestReviewsAsync<T>(int take, Expression<Func<Review, T>> selector, CancellationToken ctoken);
}
