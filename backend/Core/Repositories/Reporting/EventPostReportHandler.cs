// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Reporting;

public class EventPostReportHandler : IReportableContentHandler
{
    public ReportedContentType ContentType { get; } = ReportedContentType.EventPost;

    public string MetricTag { get; } = Core.Telemetry.MetricTags.Values.ContentTypeEventPost;

    // The post stays on the board as a deleted user's, body and all. keep-comment: plan decision, why not Restore
    public AuthorDeletionOutcome WhenAuthorDeletesAccount { get; } = AuthorDeletionOutcome.KeepPending;

    // Only a joined participant reads the board, so only they can report a post. keep-comment: privacy rule a reader cannot infer
    public async Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        return await context.EventPosts
            .IgnoreQueryFilters(["Moderation"])
            .AsNoTracking()
            .Where(p => p.Identifier == contentIdentifier
                && context.EventParticipants.Any(ep => ep.EventId == p.EventId
                    && ep.UserId == reporterUserId
                    && ep.Status == EventParticipantStatus.Joined))
            .Select(p => new ReportableContent(
                p.Id,
                p.Identifier,
                p.UserId,
                p.User != null ? p.User.NickName : null,
                null,
                null,
                p.Body,
                p.ModerationState))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var post = await context.EventPosts
            .IgnoreQueryFilters(["Moderation"])
            .FirstOrDefaultAsync(p => p.Id == contentId, ctoken);

        if (post is null)
            return false;

        post.ModerationState = state;
        return true;
    }

    public async Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken)
    {
        var post = await context.EventPosts
            .IgnoreQueryFilters(["Moderation"])
            .FirstOrDefaultAsync(p => p.Id == contentId, ctoken);

        if (post is null)
            return false;

        context.EventPosts.Remove(post);
        return true;
    }

    public async Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken)
    {
        return await context.EventPosts
            .IgnoreQueryFilters(["Moderation"])
            .Where(p => contentIds.Contains(p.Id))
            .Select(p => p.Id)
            .ToHashSetAsync(ctoken);
    }
}
