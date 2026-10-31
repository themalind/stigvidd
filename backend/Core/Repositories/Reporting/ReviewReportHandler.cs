// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Reporting;

public class ReviewReportHandler : IReportableContentHandler
{
    public ReportedContentType ContentType { get; } = ReportedContentType.Review;

    public string MetricTag { get; } = Core.Telemetry.MetricTags.Values.ContentTypeReview;

    public AuthorDeletionOutcome WhenAuthorDeletesAccount { get; } = AuthorDeletionOutcome.Restore;

    public async Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        return await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .AsNoTracking()
            .Where(r => r.Identifier == contentIdentifier)
            .Select(r => new ReportableContent(
                r.Id, r.Identifier, r.UserId, r.User != null ? r.User.NickName : null,
                r.TrailId, r.Trail != null ? r.Trail.Identifier : null, r.TrailReview, r.ModerationState))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .FirstOrDefaultAsync(r => r.Id == contentId, ctoken);

        if (review is null)
            return false;

        review.ModerationState = state;
        return true;
    }

    public async Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken)
    {
        // Loaded with its images, or the files stay on the media server after the row goes. keep-comment: why the Include
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .Include(r => r.ReviewImages)
            .FirstOrDefaultAsync(r => r.Id == contentId, ctoken);

        if (review is null)
            return false;

        effects.ImageUrls.AddRange(review.ReviewImages?.Select(i => i.ImageUrl) ?? []);
        context.Reviews.Remove(review);
        return true;
    }

    public async Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken)
    {
        return await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .Where(r => contentIds.Contains(r.Id))
            .Select(r => r.Id)
            .ToHashSetAsync(ctoken);
    }
}
