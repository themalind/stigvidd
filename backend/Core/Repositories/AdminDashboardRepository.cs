// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq.Expressions;

namespace Core.Repositories;

public class AdminDashboardRepository : IAdminDashboardRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<AdminDashboardRepository> _logger;

    public AdminDashboardRepository(IDbContextFactory<StigViddDbContext> context, ILogger<AdminDashboardRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<AdminDashboardCounts>> GetCountsAsync(DateTime since, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var userCount = await context.Users.CountAsync(ctoken);
            var newUsers = await context.Users.CountAsync(u => u.CreatedAt >= since, ctoken);
            var reviewCount = await context.Reviews.CountAsync(ctoken);
            var newReviews = await context.Reviews.CountAsync(r => r.CreatedAt >= since, ctoken);

            return RepositoryResult<AdminDashboardCounts>.Success(
                new AdminDashboardCounts(userCount, newUsers, reviewCount, newReviews));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AdminDashboardRepository: GetCountsAsync -> Something went wrong when counting users and reviews.");
            return RepositoryResult<AdminDashboardCounts>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyCollection<T>>> GetLatestReviewsAsync<T>(
        int take, Expression<Func<Review, T>> selector, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var reviews = await context.Reviews
                .IgnoreQueryFilters(["Moderation"])
                .AsNoTracking()
                .OrderByDescending(r => r.CreatedAt)
                .ThenByDescending(r => r.Id)
                .Take(take)
                .Select(selector)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyCollection<T>>.Success(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AdminDashboardRepository: GetLatestReviewsAsync -> Something went wrong when fetching the latest reviews.");
            return RepositoryResult<IReadOnlyCollection<T>>.Error();
        }
    }
}
