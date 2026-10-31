// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories.Reporting;

public class TrailObstacleReportHandler : IReportableContentHandler
{
    public ReportedContentType ContentType { get; } = ReportedContentType.TrailObstacle;

    public string MetricTag { get; } = Core.Telemetry.MetricTags.Values.ContentTypeTrailObstacle;

    public AuthorDeletionOutcome WhenAuthorDeletesAccount { get; } = AuthorDeletionOutcome.Restore;

    public async Task<ReportableContent?> FindAsync(StigViddDbContext context, string contentIdentifier, int reporterUserId, CancellationToken ctoken)
    {
        return await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .AsNoTracking()
            .Where(to => to.Identifier == contentIdentifier)
            .Select(to => new ReportableContent(
                to.Id, to.Identifier, to.UserId, to.User != null ? to.User.NickName : null,
                to.TrailId, to.Trail != null ? to.Trail.Identifier : null, to.Description, to.ModerationState))
            .FirstOrDefaultAsync(ctoken);
    }

    public async Task<bool> SetModerationStateAsync(StigViddDbContext context, int contentId, ModerationState state, CancellationToken ctoken)
    {
        var obstacle = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .FirstOrDefaultAsync(o => o.Id == contentId, ctoken);

        if (obstacle is null)
            return false;

        obstacle.ModerationState = state;
        return true;
    }

    public async Task<bool> DeleteAsync(StigViddDbContext context, int contentId, ContentDeletionEffects effects, CancellationToken ctoken)
    {
        var obstacle = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .Include(o => o.SolvedVotes)
            .FirstOrDefaultAsync(o => o.Id == contentId, ctoken);

        if (obstacle is null)
            return false;

        context.TrailObstacleSolvedVotes.RemoveRange(obstacle.SolvedVotes);
        context.TrailObstacles.Remove(obstacle);
        return true;
    }

    public async Task<HashSet<int>> ExistingIdsAsync(StigViddDbContext context, IReadOnlyCollection<int> contentIds, CancellationToken ctoken)
    {
        return await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .Where(o => contentIds.Contains(o.Id))
            .Select(o => o.Id)
            .ToHashSetAsync(ctoken);
    }
}
