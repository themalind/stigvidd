// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Repositories.Events;
using Core.Services.Push;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Reporting;

public class EventReportHandler : IReportableContentHandler
{
    public ReportedContentType ContentType { get; } = ReportedContentType.Event;

    public string MetricTag { get; } = Core.Telemetry.MetricTags.Values.ContentTypeEvent;

    // Handed over or cancelled, the event keeps the organizer's text. keep-comment: why not Restore
    public AuthorDeletionOutcome WhenAuthorDeletesAccount { get; } = AuthorDeletionOutcome.KeepPending;

    // A private event is found only by its participants and invitees, so a report cannot confirm it exists. keep-comment: privacy rule a reader cannot infer
    public async Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        return await context.Events
            .AsNoTracking()
            .Where(e => e.Identifier == contentIdentifier)
            .Where(EventQueries.FindableBy(reporterUserId))
            .Select(e => new ReportableContent(
                e.Id,
                e.Identifier,
                e.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => (int?)p.UserId).FirstOrDefault(),
                e.Participants.Where(p => p.Role == EventParticipantRole.Organizer).Select(p => p.User != null ? p.User.NickName : null).FirstOrDefault(),
                e.TrailId,
                e.Trail != null ? e.Trail.Identifier : null,
                e.Title + "\n" + e.Description,
                e.ModerationState))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var ev = await context.Events
            .FirstOrDefaultAsync(e => e.Id == contentId, ctoken);

        if (ev is null)
            return false;

        ev.ModerationState = state;
        return true;
    }

    public async Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken)
    {
        var deleted = await EventRemoval.RemoveAsync(context, e => e.Id == contentId, actingUserId: null, DateTime.UtcNow, ctoken);

        if (deleted is null)
            return false;

        if (deleted.ImageUrl is not null)
            effects.ImageUrls.Add(deleted.ImageUrl);

        if (deleted.NotifyUserIds.Count > 0)
            effects.Pushes.Add(EventPushes.Cancelled(deleted.Identifier, deleted.Title, deleted.StartsAt, deleted.NotifyUserIds, cancelledByUserId: null));

        return true;
    }

    public async Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken)
    {
        return await context.Events
            .Where(e => contentIds.Contains(e.Id))
            .Select(e => e.Id)
            .ToHashSetAsync(ctoken);
    }
}
