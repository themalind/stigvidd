// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Reporting;

public class HikeImageReportHandler : IReportableContentHandler
{
    public ReportedContentType ContentType { get; } = ReportedContentType.HikeImage;

    public string MetricTag { get; } = Core.Telemetry.MetricTags.Values.ContentTypeHikeImage;

    // Stays hidden: there is no rating to keep, and a shared hike outlives its owner. keep-comment: deliberate asymmetry with reviews
    public AuthorDeletionOutcome WhenAuthorDeletesAccount { get; } = AuthorDeletionOutcome.Expire;

    // Only the owner or an accepted recipient finds it; the owner then gets the service's "own content" 400. keep-comment: privacy rule a reader cannot infer
    public async Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        return await context.HikeImages
            .AsNoTracking()
            .Where(hi => hi.Identifier == contentIdentifier
                && hi.Hike != null
                && (hi.Hike.UserId == reporterUserId
                    || context.HikeShares.Any(s => s.HikeId == hi.HikeId
                        && s.SharedWithId == reporterUserId
                        && s.Status == HikeShareStatus.Accepted)))
            .Select(hi => new ReportableContent(
                hi.Id,
                hi.Identifier,
                hi.Hike != null ? hi.Hike.UserId : null,
                hi.Hike != null ? hi.Hike.CreatedByNickName : null,
                null,
                null,
                hi.ImageUrl,
                hi.ModerationState))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var hikeImage = await context.HikeImages
            .FirstOrDefaultAsync(hi => hi.Id == contentId, ctoken);

        if (hikeImage is null)
            return false;

        hikeImage.ModerationState = state;
        return true;
    }

    public async Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken)
    {
        var hikeImage = await context.HikeImages
            .FirstOrDefaultAsync(hi => hi.Id == contentId, ctoken);

        if (hikeImage is null)
            return false;

        effects.ImageUrls.Add(hikeImage.ImageUrl);
        context.HikeImages.Remove(hikeImage);
        return true;
    }

    public async Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken)
    {
        return await context.HikeImages
            .Where(hi => contentIds.Contains(hi.Id))
            .Select(hi => hi.Id)
            .ToHashSetAsync(ctoken);
    }
}
