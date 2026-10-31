// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Repositories.Events;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Reporting;

public class EventImageReportHandler : IReportableContentHandler
{
    public ReportedContentType ContentType { get; } = ReportedContentType.EventImage;

    public string MetricTag { get; } = Core.Telemetry.MetricTags.Values.ContentTypeEventImage;

    public AuthorDeletionOutcome WhenAuthorDeletesAccount { get; } = AuthorDeletionOutcome.KeepPending;

    // Whoever can see the event can see its cover, so the same rule as EventReportHandler. keep-comment: privacy rule a reader cannot infer
    public async Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        var findableEventIds = context.Events.Where(EventQueries.FindableBy(reporterUserId)).Select(e => e.Id);

        return await context.EventImages
            .AsNoTracking()
            .Where(i => i.Identifier == contentIdentifier && findableEventIds.Contains(i.EventId))
            .Select(i => new ReportableContent(
                i.Id,
                i.Identifier,
                i.Event != null
                    ? i.Event.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => (int?)p.UserId).FirstOrDefault()
                    : null,
                i.Event != null
                    ? i.Event.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => p.User != null ? p.User.NickName : null).FirstOrDefault()
                    : null,
                null,
                null,
                i.ImageUrl,
                i.ModerationState))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var image = await context.EventImages
            .FirstOrDefaultAsync(i => i.Id == contentId, ctoken);

        if (image is null)
            return false;

        image.ModerationState = state;
        return true;
    }

    public async Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken)
    {
        var image = await context.EventImages
            .FirstOrDefaultAsync(i => i.Id == contentId, ctoken);

        if (image is null)
            return false;

        effects.ImageUrls.Add(image.ImageUrl);
        context.EventImages.Remove(image);
        return true;
    }

    public async Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken)
    {
        return await context.EventImages
            .Where(i => contentIds.Contains(i.Id))
            .Select(i => i.Id)
            .ToHashSetAsync(ctoken);
    }
}
