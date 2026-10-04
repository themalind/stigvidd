// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Enums;
using WebDataContracts.ResponseModels.Admin;

namespace Core.Services;

public class AdminDashboardService : IAdminDashboardService
{
    private const int LatestReviewCount = 5;
    private const int RecentDays = 7;

    private readonly IAdminDashboardRepository _repository;

    public AdminDashboardService(IAdminDashboardRepository repository)
    {
        _repository = repository;
    }

    public async Task<Result<AdminDashboardResponse>> GetDashboardAsync(CancellationToken ctoken)
    {
        var counts = await _repository.GetCountsAsync(DateTime.UtcNow.AddDays(-RecentDays), ctoken);

        if (!counts.IsSuccess)
            return Result.Fail<AdminDashboardResponse>(new Message(500, "The dashboard counts could not be read."));

        var latest = await _repository.GetLatestReviewsAsync(
            LatestReviewCount,
            r => new AdminDashboardReviewResponse
            {
                Identifier = r.Identifier,
                TrailIdentifier = r.Trail!.Identifier,
                TrailName = r.Trail.Name,
                Rating = r.Rating,
                Text = r.TrailReview,
                AuthorNickName = r.User != null ? r.User.NickName : null,
                ImageCount = r.ReviewImages!.Count,
                IsHidden = r.ModerationState == ModerationState.HiddenPendingReview,
                CreatedAt = r.CreatedAt,
            },
            ctoken);

        if (!latest.IsSuccess)
            return Result.Fail<AdminDashboardResponse>(new Message(500, "The latest reviews could not be read."));

        return Result.Ok(new AdminDashboardResponse
        {
            UserCount = counts.Value.UserCount,
            NewUsersLast7Days = counts.Value.NewUsers,
            ReviewCount = counts.Value.ReviewCount,
            ReviewsLast7Days = counts.Value.NewReviews,
            LatestReviews = latest.Value,
        });
    }
}
