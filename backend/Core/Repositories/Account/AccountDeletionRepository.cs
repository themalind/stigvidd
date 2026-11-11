// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Repositories.Reporting;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Account;

public class AccountDeletionRepository : IAccountDeletionRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly IKeycloakAdminRepository _keycloakAdminRepository;
    private readonly ReportableContentHandlers _reportHandlers;
    private readonly IEnumerable<IAccountDeletionStep> _steps;
    private readonly ILogger<AccountDeletionRepository> _logger;

    public AccountDeletionRepository(IDbContextFactory<StigViddDbContext> context, IKeycloakAdminRepository keycloakAdminRepository, ReportableContentHandlers reportHandlers, IEnumerable<IAccountDeletionStep> steps, ILogger<AccountDeletionRepository> logger)
    {
        _context = context;
        _keycloakAdminRepository = keycloakAdminRepository;
        _reportHandlers = reportHandlers;
        _steps = steps;
        _logger = logger;
    }

    public async Task<RepositoryResult<DeletedAccount>> DeleteAccountAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var user = await context.Users
                .FirstOrDefaultAsync(u => u.Identifier == identifier, ctoken);

            if (user is null)
                return RepositoryResult<DeletedAccount>.NotFound();

            using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            // keep-comment: URLs are read before their rows go, and only for rows that really go.
            var fileUrls = await GetDeletableHikeImageUrlsAsync(context, user.Id, ctoken);
            fileUrls.AddRange(await GetReviewImageUrlsAsync(context, user.Id, ctoken));

            await DeleteUnsharedHikesAsync(context, user.Id, ctoken);
            await AnonymizeSharedHikesAsync(context, user.Id, ctoken);
            await DeleteReceivedHikeSharesAsync(context, user.Id, ctoken);
            fileUrls.AddRange(await DeleteHikeSubmissionsAsync(context, user.Id, ctoken));
            await AnonymizeReviewsAsync(context, user.Id, ctoken);
            await AnonymizeObstaclesAsync(context, user.Id, ctoken);
            await SettleContentReportsAsync(context, user.Id, ctoken);
            await DeleteFriendRequestsAsync(context, user.Id, ctoken);
            await EraseOutboxMailAsync(context, user.Email, ctoken);

            var pushes = new List<PushMessage>();
            foreach (var step in _steps)
            {
                var effects = await step.RunAsync(context, user.Id, ctoken);
                fileUrls.AddRange(effects.FileUrls);
                pushes.AddRange(effects.Pushes);
            }

            context.UserBlocks.RemoveRange(context.UserBlocks
                .Where(ub => ub.BlockerUserId == user.Id || ub.BlockedUserId == user.Id));
            context.FriendNotes.RemoveRange(context.FriendNotes
                .Where(fn => fn.OwnerUserId == user.Id || fn.FriendUserId == user.Id));
            context.UserActionLogs.RemoveRange(context.UserActionLogs.Where(l => l.UserId == user.Id));
            // No foreign key to Users, and the row carries the email and nickname. keep-comment: why it is not cascaded
            context.UserKeycloakMappings.RemoveRange(context.UserKeycloakMappings
                .Where(m => m.PackageUserId == user.Id || m.KeycloakSubjectId == user.SubjectId));
            context.Users.Remove(user);
#if !WINDOWS
            // keep-comment: in-memory SQLite on Linux does not cascade these.
            context.TrailObstacleSolvedVotes.RemoveRange(context.TrailObstacleSolvedVotes.Where(v => v.UserId == user.Id));
#endif
            await context.SaveChangesAsync(ctoken);

            // keep-comment: last before commit, so a Keycloak failure rolls back every row above.
            await _keycloakAdminRepository.DeleteUserAsync(user.SubjectId, ctoken);

            await transaction.CommitAsync(ctoken);

            return RepositoryResult<DeletedAccount>.Success(new DeletedAccount(user.Id, fileUrls, pushes));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AccountDeletionRepository: DeleteAccountAsync -> Something went wrong when deleting user with identifier {identifier}; nothing was changed.", identifier);
            return RepositoryResult<DeletedAccount>.Error();
        }
    }

    // keep-comment: a shared hike is kept for its recipients, so the URL read and the delete must agree on this set.
    private IQueryable<Hike> UnsharedHikes(StigViddDbContext context, int userId)
    {
        return context.Hikes.Where(h => h.UserId == userId && !context.HikeShares.Any(hs => hs.HikeId == h.Id));
    }

    // keep-comment: past the moderation filter, or a hidden review's files stay on WebDAV forever.
    private IQueryable<Review> UserReviews(StigViddDbContext context, int userId)
    {
        return context.Reviews.IgnoreQueryFilters(["Moderation"]).Where(r => r.UserId == userId);
    }

    private Task<List<string>> GetDeletableHikeImageUrlsAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        var hikeIds = UnsharedHikes(context, userId).Select(h => h.Id);

        return context.HikeImages
            .Where(hi => hikeIds.Contains(hi.HikeId))
            .Select(hi => hi.ImageUrl)
            .ToListAsync(ctoken);
    }

    private Task<List<string>> GetReviewImageUrlsAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        var reviewIds = UserReviews(context, userId).Select(r => r.Id);

        // keep-comment: IgnoreQueryFilters applies per query, so the outer one needs it too.
        return context.ReviewImages
            .IgnoreQueryFilters(["Moderation"])
            .Where(ri => reviewIds.Contains(ri.ReviewId))
            .Select(ri => ri.ImageUrl)
            .ToListAsync(ctoken);
    }

    private async Task DeleteUnsharedHikesAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        context.Hikes.RemoveRange(await UnsharedHikes(context, userId).ToListAsync(ctoken));
        await context.SaveChangesAsync(ctoken);
    }

    // keep-comment: what is left is shared; it outlives its creator, but their identifiers must not.
    private async Task AnonymizeSharedHikesAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        foreach (var hike in await context.Hikes.Where(h => h.UserId == userId).ToListAsync(ctoken))
        {
            hike.CreatedBy = null;
            hike.CreatedByNickName = null;
            hike.UserId = null;
        }

        await context.SaveChangesAsync(ctoken);
    }

    private async Task DeleteReceivedHikeSharesAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        context.HikeShares.RemoveRange(await context.HikeShares
            .Where(hs => hs.SharedWithId == userId)
            .ToListAsync(ctoken));
        await context.SaveChangesAsync(ctoken);
    }

    private async Task<List<string>> DeleteHikeSubmissionsAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        var submissions = await context.HikeSubmissions
            .Include(s => s.Images)
            .Where(s => s.UserId == userId)
            .ToListAsync(ctoken);

        context.HikeSubmissions.RemoveRange(submissions);
        await context.SaveChangesAsync(ctoken);

        return submissions.SelectMany(s => s.Images).Select(i => i.ImageUrl).ToList();
    }

    // keep-comment: keeps the rating; UserId is nulled by SetNull when the user row goes.
    private async Task AnonymizeReviewsAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        var reviews = await UserReviews(context, userId)
            .Include(r => r.ReviewImages)
            .ToListAsync(ctoken);

        foreach (var review in reviews)
            review.TrailReview = null;

        context.ReviewImages.RemoveRange(reviews.SelectMany(r => r.ReviewImages ?? []));

        await context.SaveChangesAsync(ctoken);
    }

    // keep-comment: Other keeps its text since the category says nothing on its own.
    private async Task AnonymizeObstaclesAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        var obstacles = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .Where(to => to.UserId == userId && to.IssueType != TrailIssueType.Other)
            .ToListAsync(ctoken);

        foreach (var obstacle in obstacles)
            obstacle.Description = string.Empty;

        await context.SaveChangesAsync(ctoken);
    }

    // keep-comment: before the user row, whose SetNull on ReporterUserId would hide what they reported.
    private async Task SettleContentReportsAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        // As the author: nothing is left to moderate, so the report settles and the content comes back. keep-comment: or the rating stays out of every trail average
        var aboutThem = await context.ContentReports
            .Where(r => r.ContentAuthorUserId == userId)
            .ToListAsync(ctoken);

        foreach (var report in aboutThem)
            await SettleReportAboutAuthorAsync(context, report, ctoken);

        // As the reporter: the content still exists and still needs a decision, so only the free text goes. keep-comment: why the report stays pending
        var byThem = await context.ContentReports
            .Where(r => r.ReporterUserId == userId)
            .ToListAsync(ctoken);

        foreach (var report in byThem)
            report.ReporterNote = null;

        await context.SaveChangesAsync(ctoken);
    }

    private async Task SettleReportAboutAuthorAsync(StigViddDbContext context, ContentReport report, CancellationToken ctoken)
    {
        var handler = _reportHandlers.For(report.ContentType);
        var outcome = handler?.WhenAuthorDeletesAccount ?? AuthorDeletionOutcome.Expire;

        report.AuthorNickNameSnapshot = null;
        report.ContentAuthorUserId = null;

        // The snapshot stays while the content it copies still exists and awaits a decision. keep-comment: KeepPending needs it to be judged
        if (outcome == AuthorDeletionOutcome.KeepPending && report.Status == ReportStatus.Pending)
            return;

        report.ContentSnapshot = null;

        if (report.Status == ReportStatus.Pending)
            report.Status = ReportStatus.ContentExpired;

        if (handler is not null && outcome == AuthorDeletionOutcome.Restore)
            await handler.SetModerationStateAsync(context, report.ContentId, ModerationState.Visible, ctoken);
    }

    // keep-comment: FriendRequests are NoAction to avoid multiple cascade paths.
    private async Task DeleteFriendRequestsAsync(StigViddDbContext context, int userId, CancellationToken ctoken)
    {
        context.FriendRequests.RemoveRange(await context.FriendRequests
            .Where(fr => fr.RequesterId == userId || fr.ReceiverId == userId)
            .ToListAsync(ctoken));
        await context.SaveChangesAsync(ctoken);
    }

    // keep-comment: the outbox keys on the address, with no foreign key to Users.
    private async Task EraseOutboxMailAsync(StigViddDbContext context, string emailAddress, CancellationToken ctoken)
    {
        // keep-comment: ToLower on both sides; Postgres and SQLite disagree on LIKE, and ILike throws on SQLite.
        var needle = emailAddress.Trim().ToLower();

        // Cancelled first, or a claim in between makes the delete spare it and it goes out. keep-comment: NOTHING TESTS THIS; no test can land a claim in that window
        var queued = await context.OutboxEmails
            .Where(e => e.ToAddress.ToLower() == needle && e.Status == OutboxEmailStatus.Pending)
            .ToListAsync(ctoken);

        foreach (var email in queued)
        {
            email.Status = OutboxEmailStatus.Cancelled;
            email.SettledAt = DateTime.UtcNow;
            email.LastUpdatedAt = DateTime.UtcNow;
        }

        if (queued.Count > 0)
            await context.SaveChangesAsync(ctoken);

        // keep-comment: a Sending row is on the wire and cannot be recalled; the sweep collects it once it settles.
        context.OutboxEmails.RemoveRange(await context.OutboxEmails
            .Where(e => e.ToAddress.ToLower() == needle && e.Status != OutboxEmailStatus.Sending)
            .ToListAsync(ctoken));
        await context.SaveChangesAsync(ctoken);
    }
}
