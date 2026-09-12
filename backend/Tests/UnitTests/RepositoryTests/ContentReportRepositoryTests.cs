// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class ContentReportRepositoryTests : TestBase
{
    private const string HiddenReviewIdentifier = "hidden-1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";
    private const string VisibleReviewIdentifier = "shown-2b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e";
    private const int ReporterUserId = 2;

    private static Review Review(string identifier, ModerationState state) => new()
    {
        Identifier = identifier,
        TrailReview = "Text",
        Rating = 3M,
        TrailId = 1,
        UserId = 1,
        ModerationState = state,
    };

    private static ContentReportRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<ContentReportRepository>.Instance);

    // The whole point of reading past the filter: a second reporter must be able to report
    // something the first reporter already got hidden.
    [Fact]
    public async Task GetReportableContent_FindsAnAlreadyHiddenReview()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.Reviews.Add(Review(HiddenReviewIdentifier, ModerationState.HiddenPendingReview)));

        // Act
        var result = await Build(factory).GetReportableContentAsync(
            ReportedContentType.Review, HiddenReviewIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ModerationState.Should().Be(ModerationState.HiddenPendingReview);
        result.Value!.ContentIdentifier.Should().Be(HiddenReviewIdentifier);
    }

    [Fact]
    public async Task GetReportableContent_WhenTheIdentifierIsUnknown_ReturnsNotFound()
    {
        // Arrange
        var factory = CreateSeededFactory();

        // Act
        var result = await Build(factory).GetReportableContentAsync(
            ReportedContentType.Review, "no-such-review", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task AddReport_WhenHiding_WritesTheRowAndFlipsTheContentInOneGo()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.Reviews.Add(Review(VisibleReviewIdentifier, ModerationState.Visible)));
        var repository = Build(factory);
        var content = await repository.GetReportableContentAsync(
            ReportedContentType.Review, VisibleReviewIdentifier, TestContext.Current.CancellationToken);

        // Act
        var result = await repository.AddReportAsync(
            ReportFor(content.Value!.ContentId, VisibleReviewIdentifier), hideContent: true, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(r => r.Identifier == VisibleReviewIdentifier, TestContext.Current.CancellationToken);
        review.ModerationState.Should().Be(ModerationState.HiddenPendingReview);
        context.ContentReports.Should().ContainSingle();
    }

    [Fact]
    public async Task AddReport_WhenNotHiding_WritesTheRowAndLeavesTheContentVisible()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.Reviews.Add(Review(VisibleReviewIdentifier, ModerationState.Visible)));
        var repository = Build(factory);
        var content = await repository.GetReportableContentAsync(
            ReportedContentType.Review, VisibleReviewIdentifier, TestContext.Current.CancellationToken);

        // Act
        var result = await repository.AddReportAsync(
            ReportFor(content.Value!.ContentId, VisibleReviewIdentifier), hideContent: false, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(r => r.Identifier == VisibleReviewIdentifier, TestContext.Current.CancellationToken);
        review.ModerationState.Should().Be(ModerationState.Visible);
    }

    // Rolling window: an older report must fall out of the count rather than counting
    // forever against a calendar day.
    [Fact]
    public async Task CountReportsByReporterSince_LeavesOutAReportOlderThanTheWindow()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            db.ContentReports.Add(ReportFor(1, "old", createdAt: DateTime.UtcNow.AddHours(-26)));
            db.ContentReports.Add(ReportFor(2, "recent", createdAt: DateTime.UtcNow.AddHours(-1)));
        });

        // Act
        var result = await Build(factory).CountReportsByReporterSinceAsync(
            ReporterUserId, DateTime.UtcNow.AddHours(-24), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task CountDismissedReportsByReporter_CountsOnlyDismissed()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            db.ContentReports.Add(ReportFor(1, "a", status: ReportStatus.Dismissed));
            db.ContentReports.Add(ReportFor(2, "b", status: ReportStatus.Dismissed));
            db.ContentReports.Add(ReportFor(3, "c", status: ReportStatus.Pending));
            db.ContentReports.Add(ReportFor(4, "d", status: ReportStatus.Upheld));
        });

        // Act
        var result = await Build(factory).CountDismissedReportsByReporterAsync(
            ReporterUserId, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(2);
    }

    [Fact]
    public async Task HandleUserDeletion_AsAuthor_ClearsTheSnapshotSettlesTheReportAndRestoresTheContent()
    {
        // Arrange — the deleted user wrote the review, someone else reported it
        var factory = CreateSeededFactory(db =>
        {
            db.Reviews.Add(Review(HiddenReviewIdentifier, ModerationState.HiddenPendingReview));
            db.SaveChanges();
            var reviewId = db.Reviews.IgnoreQueryFilters(["Moderation"]).Single(r => r.Identifier == HiddenReviewIdentifier).Id;
            db.ContentReports.Add(ReportFor(reviewId, HiddenReviewIdentifier, authorUserId: 1));
        });

        // Act
        var result = await Build(factory).HandleUserDeletionAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var report = await context.ContentReports.SingleAsync(TestContext.Current.CancellationToken);
        report.ContentSnapshot.Should().BeNull();
        report.AuthorNickNameSnapshot.Should().BeNull();
        report.Status.Should().Be(ReportStatus.ContentExpired);

        // Restored, or the rating stays out of every trail average forever
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(r => r.Identifier == HiddenReviewIdentifier, TestContext.Current.CancellationToken);
        review.ModerationState.Should().Be(ModerationState.Visible);
    }

    [Fact]
    public async Task HandleUserDeletion_AsReporter_ClearsOnlyTheNoteAndKeepsTheReportPending()
    {
        // Arrange — the deleted user reported someone else's content
        var factory = CreateSeededFactory(db =>
            db.ContentReports.Add(ReportFor(1, "other-content", authorUserId: 99)));

        // Act
        var result = await Build(factory).HandleUserDeletionAsync(ReporterUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var report = await context.ContentReports.SingleAsync(TestContext.Current.CancellationToken);
        report.ReporterNote.Should().BeNull();
        report.Status.Should().Be(ReportStatus.Pending);
        report.ContentSnapshot.Should().NotBeNull();
    }

    private static ContentReport ReportFor(
        int contentId,
        string contentIdentifier,
        int? authorUserId = 1,
        ReportStatus status = ReportStatus.Pending,
        DateTime? createdAt = null) => new()
        {
            ContentType = ReportedContentType.Review,
            ContentId = contentId,
            ContentIdentifier = contentIdentifier,
            ContentSnapshot = "Text",
            AuthorNickNameSnapshot = "Author",
            ContentAuthorUserId = authorUserId,
            ReporterUserId = ReporterUserId,
            Reason = ReportReason.Offensive,
            ReporterNote = "Note",
            Status = status,
            HideOutcome = ReportHideOutcome.Hidden,
            CreatedAt = createdAt ?? DateTime.UtcNow,
        };

    // --- Applying a decision ---

    private const string ReviewWithImagesIdentifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // review 1, two images
    private const string ObstacleWithVotesIdentifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // obstacle 3, three votes

    private static IDbContextFactory<StigViddDbContext> FactoryWithReportsOn(
        ReportedContentType contentType, int contentId, int reporterCount, ModerationState state) =>
        CreateSeededFactory(db =>
        {
            Hide(db, contentType, contentId, state);

            for (var reporter = 1; reporter <= reporterCount; reporter++)
                db.ContentReports.Add(new ContentReport
                {
                    Identifier = $"decide-report-{reporter}",
                    ContentType = contentType,
                    ContentId = contentId,
                    ContentIdentifier = "content",
                    ContentSnapshot = "Text",
                    AuthorNickNameSnapshot = "Author",
                    ContentAuthorUserId = 3,
                    ReporterUserId = reporter,
                    Reason = ReportReason.Offensive,
                    Status = ReportStatus.Pending,
                    HideOutcome = ReportHideOutcome.Hidden,
                });
        });

    private static void Hide(StigViddDbContext db, ReportedContentType contentType, int contentId, ModerationState state)
    {
        if (contentType == ReportedContentType.Review)
            db.Reviews.IgnoreQueryFilters(["Moderation"]).Single(r => r.Id == contentId).ModerationState = state;
        else
            db.TrailObstacles.IgnoreQueryFilters(["Moderation"]).Single(o => o.Id == contentId).ModerationState = state;
    }

    // One decision, every pending report on that content settled. Otherwise the same review
    // sits in the queue once per reporter.
    [Fact]
    public async Task ApplyDecision_SettlesEveryPendingReportOnTheSameContent()
    {
        // Arrange — three people reported review 1
        var factory = FactoryWithReportsOn(ReportedContentType.Review, 1, 3, ModerationState.HiddenPendingReview);

        // Act
        var result = await Build(factory).ApplyDecisionAsync(
            ReportedContentType.Review, 1, ReportStatus.Upheld, "moderator", "Breaks the rules",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.ReportsSettled.Should().Be(3);

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var reports = await context.ContentReports.ToListAsync(TestContext.Current.CancellationToken);
        reports.Should().AllSatisfy(r =>
        {
            r.Status.Should().Be(ReportStatus.Upheld);
            r.DecidedBy.Should().Be("moderator");
            r.DecidedAt.Should().NotBeNull();
            r.DecisionNote.Should().Be("Breaks the rules");
        });
    }

    [Fact]
    public async Task ApplyDecision_UpholdingAReview_DeletesTheRowAndHandsBackItsImageUrls()
    {
        // Arrange
        var factory = FactoryWithReportsOn(ReportedContentType.Review, 1, 1, ModerationState.HiddenPendingReview);

        // Act
        var result = await Build(factory).ApplyDecisionAsync(
            ReportedContentType.Review, 1, ReportStatus.Upheld, "moderator", null,
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.DeletedImageUrls.Should().BeEquivalentTo([
            "https://inkaben.se/stigvidd/mock/review-tiveden-1.jpg",
            "https://inkaben.se/stigvidd/mock/review-tiveden-2.jpg",
        ]);

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stillThere = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .AnyAsync(r => r.Identifier == ReviewWithImagesIdentifier, TestContext.Current.CancellationToken);
        stillThere.Should().BeFalse();
    }

    [Fact]
    public async Task ApplyDecision_UpholdingAnObstacle_DeletesTheRowAndItsSolvedVotes()
    {
        // Arrange — obstacle 3 carries three solved votes
        var factory = FactoryWithReportsOn(ReportedContentType.TrailObstacle, 3, 1, ModerationState.HiddenPendingReview);

        // Act
        var result = await Build(factory).ApplyDecisionAsync(
            ReportedContentType.TrailObstacle, 3, ReportStatus.Upheld, "moderator", null,
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.DeletedImageUrls.Should().BeEmpty();

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var obstacleGone = !await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .AnyAsync(o => o.Identifier == ObstacleWithVotesIdentifier, TestContext.Current.CancellationToken);
        var votesGone = !await context.TrailObstacleSolvedVotes
            .AnyAsync(v => v.TrailObstacleId == 3, TestContext.Current.CancellationToken);

        obstacleGone.Should().BeTrue();
        votesGone.Should().BeTrue();
    }

    [Fact]
    public async Task ApplyDecision_DismissingPutsTheContentBack()
    {
        // Arrange
        var factory = FactoryWithReportsOn(ReportedContentType.Review, 1, 1, ModerationState.HiddenPendingReview);

        // Act
        var result = await Build(factory).ApplyDecisionAsync(
            ReportedContentType.Review, 1, ReportStatus.Dismissed, "moderator", null,
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AppliedStatus.Should().Be(ReportStatus.Dismissed);

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(r => r.Identifier == ReviewWithImagesIdentifier, TestContext.Current.CancellationToken);
        review.ModerationState.Should().Be(ModerationState.Visible);
    }

    // Retention may have taken an obstacle before anyone decided. Dismissing then has nothing
    // to restore, and must record that rather than fail or count against the reporter.
    [Fact]
    public async Task ApplyDecision_DismissingContentThatIsGone_RecordsContentExpired()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.Add(new ContentReport
        {
            Identifier = "decide-report-gone",
            ContentType = ReportedContentType.Review,
            ContentId = 9999,
            ContentIdentifier = "content",
            ContentAuthorUserId = 3,
            ReporterUserId = 1,
            Reason = ReportReason.Offensive,
            Status = ReportStatus.Pending,
            HideOutcome = ReportHideOutcome.Hidden,
        }));

        // Act
        var result = await Build(factory).ApplyDecisionAsync(
            ReportedContentType.Review, 9999, ReportStatus.Dismissed, "moderator", null,
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.AppliedStatus.Should().Be(ReportStatus.ContentExpired);

        using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var report = await context.ContentReports.SingleAsync(TestContext.Current.CancellationToken);
        report.Status.Should().Be(ReportStatus.ContentExpired);
    }

    // Strikes count distinct content. A review three people reported and that is upheld is
    // ONE strike, not three, and that number drives a decision to delete someone's account.
    [Fact]
    public async Task CountUpheldContentByAuthor_CountsContentOnceHoweverManyPeopleReportedIt()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            for (var reporter = 1; reporter <= 3; reporter++)
                db.ContentReports.Add(new ContentReport
                {
                    Identifier = $"strike-report-{reporter}",
                    ContentType = ReportedContentType.Review,
                    ContentId = 1,
                    ContentIdentifier = "content",
                    ContentAuthorUserId = 3,
                    ReporterUserId = reporter,
                    Reason = ReportReason.Offensive,
                    Status = ReportStatus.Upheld,
                    HideOutcome = ReportHideOutcome.Hidden,
                });
        });

        // Act
        var result = await Build(factory).CountUpheldContentByAuthorAsync(3, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task CountUpheldContentByAuthor_CountsTwoDifferentPiecesOfContentAsTwo()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            db.ContentReports.Add(new ContentReport
            {
                Identifier = "strike-a",
                ContentType = ReportedContentType.Review,
                ContentId = 1,
                ContentIdentifier = "content-a",
                ContentAuthorUserId = 3,
                ReporterUserId = 1,
                Reason = ReportReason.Offensive,
                Status = ReportStatus.Upheld,
                HideOutcome = ReportHideOutcome.Hidden,
            });
            db.ContentReports.Add(new ContentReport
            {
                Identifier = "strike-b",
                ContentType = ReportedContentType.TrailObstacle,
                ContentId = 1,
                ContentIdentifier = "content-b",
                ContentAuthorUserId = 3,
                ReporterUserId = 1,
                Reason = ReportReason.Spam,
                Status = ReportStatus.Upheld,
                HideOutcome = ReportHideOutcome.Hidden,
            });
        });

        // Act
        var result = await Build(factory).CountUpheldContentByAuthorAsync(3, TestContext.Current.CancellationToken);

        // Assert — a review and an obstacle that share an id are still two pieces of content
        result.Value.Should().Be(2);
    }

    // The queue is the one place that has to see hidden content, so its existence flag must
    // not be fooled by the moderation filter.
    [Fact]
    public async Task GetPaged_SaysHiddenContentStillExists()
    {
        // Arrange
        var factory = FactoryWithReportsOn(ReportedContentType.Review, 1, 1, ModerationState.HiddenPendingReview);

        // Act
        var result = await Build(factory).GetPagedAsync(null, null, null, 1, 25, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().ContainSingle()
            .Which.ContentStillExists.Should().BeTrue();
    }

    [Fact]
    public async Task GetPaged_FiltersOnStatus()
    {
        // Arrange
        var factory = FactoryWithReportsOn(ReportedContentType.Review, 1, 2, ModerationState.HiddenPendingReview);

        // Act
        var pending = await Build(factory).GetPagedAsync(
            ReportStatus.Pending, null, null, 1, 25, TestContext.Current.CancellationToken);
        var upheld = await Build(factory).GetPagedAsync(
            ReportStatus.Upheld, null, null, 1, 25, TestContext.Current.CancellationToken);

        // Assert
        pending.Value!.TotalCount.Should().Be(2);
        upheld.Value!.TotalCount.Should().Be(0);
    }

    // The nickname is read off the id where the user is still there, so a rename does not
    // leave the strike list pointing at a name nobody recognises.
    [Fact]
    public async Task GetPaged_PrefersTheCurrentNicknameOverTheSnapshot()
    {
        // Arrange — the snapshot says something the author has since changed away from
        var factory = CreateSeededFactory(db => db.ContentReports.Add(new ContentReport
        {
            Identifier = "nickname-report",
            ContentType = ReportedContentType.Review,
            ContentId = 1,
            ContentIdentifier = "content",
            AuthorNickNameSnapshot = "OldName",
            ContentAuthorUserId = 3,
            ReporterUserId = 1,
            Reason = ReportReason.Offensive,
            Status = ReportStatus.Pending,
            HideOutcome = ReportHideOutcome.Hidden,
        }));

        // Act
        var result = await Build(factory).GetPagedAsync(null, null, null, 1, 25, TestContext.Current.CancellationToken);

        // Assert — user 3 is SkogsGreven in the seed
        result.Value!.Items.Should().ContainSingle()
            .Which.AuthorNickName.Should().Be("SkogsGreven");
    }

    [Fact]
    public async Task GetCountsByStatus_ReportsAZeroForAStatusNothingIsIn()
    {
        // Arrange
        var factory = FactoryWithReportsOn(ReportedContentType.Review, 1, 2, ModerationState.HiddenPendingReview);

        // Act
        var result = await Build(factory).GetCountsByStatusAsync(TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value![ReportStatus.Pending].Should().Be(2);
        result.Value[ReportStatus.Upheld].Should().Be(0);
    }

    // --- The statistics tabs ---

    private static ContentReport StatRow(
        int? reporterUserId,
        int? authorUserId,
        ReportStatus status,
        int contentId = 1,
        ReportedContentType contentType = ReportedContentType.Review,
        DateTime? createdAt = null,
        string? authorNickNameSnapshot = "Author") => new()
        {
            Identifier = Guid.NewGuid().ToString(),
            ContentType = contentType,
            ContentId = contentId,
            ContentIdentifier = $"content-{contentType}-{contentId}",
            ContentSnapshot = "Text",
            AuthorNickNameSnapshot = authorNickNameSnapshot,
            ContentAuthorUserId = authorUserId,
            ReporterUserId = reporterUserId,
            Reason = ReportReason.Offensive,
            Status = status,
            HideOutcome = ReportHideOutcome.Hidden,
            CreatedAt = createdAt ?? DateTime.UtcNow,
        };

    [Fact]
    public async Task GetReporterStatistics_CountsEveryStatusAndNamesTheReporter()
    {
        // Arrange - user 2 is VandrarVennen in the seed.
        var newest = new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc);
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 1, ReportStatus.Pending, contentId: 1, createdAt: newest.AddDays(-2)),
            StatRow(2, 1, ReportStatus.Dismissed, contentId: 2, createdAt: newest.AddDays(-1)),
            StatRow(2, 1, ReportStatus.Upheld, contentId: 3, createdAt: newest)));

        // Act
        var result = await Build(factory).GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var reporter = result.Value!.Items.Should().ContainSingle().Subject;
        reporter.NickName.Should().Be("VandrarVennen");
        reporter.Total.Should().Be(3);
        reporter.Pending.Should().Be(1);
        reporter.Dismissed.Should().Be(1);
        reporter.Upheld.Should().Be(1);
        reporter.LastReportedAt.Should().Be(newest);
    }

    // The tab exists to find the account whose reports keep turning out to be wrong, so the
    // order is the feature rather than a presentation detail.
    [Fact]
    public async Task GetReporterStatistics_PutsTheMostDismissedFirst()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 1, ReportStatus.Dismissed, contentId: 1),
            StatRow(3, 1, ReportStatus.Dismissed, contentId: 2),
            StatRow(3, 1, ReportStatus.Dismissed, contentId: 3),
            StatRow(4, 1, ReportStatus.Upheld, contentId: 4)));

        // Act
        var result = await Build(factory).GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Select(r => r.ReporterUserId).Should().ContainInOrder(3, 2, 4);
    }

    // A deleted account has ReporterUserId nulled by the FK, and a row nobody is behind
    // cannot be acted on. Grouping them together would read as one very busy reporter.
    [Fact]
    public async Task GetReporterStatistics_LeavesOutReportsWhoseReporterIsGone()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 1, ReportStatus.Pending, contentId: 1),
            StatRow(null, 1, ReportStatus.Pending, contentId: 2),
            StatRow(null, 1, ReportStatus.Pending, contentId: 3)));

        // Act
        var result = await Build(factory).GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        var reporter = result.Value!.Items.Should().ContainSingle().Subject;
        reporter.ReporterUserId.Should().Be(2);
        reporter.Total.Should().Be(1);
        result.Value!.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetReporterStatistics_PagesOnTheAggregateRatherThanOnRows()
    {
        // Arrange - three reporters, one report each, page size one.
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 1, ReportStatus.Dismissed, contentId: 1),
            StatRow(3, 1, ReportStatus.Pending, contentId: 2),
            StatRow(4, 1, ReportStatus.Pending, contentId: 3)));

        // Act
        var result = await Build(factory).GetReporterStatisticsAsync(1, 1, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Should().ContainSingle();
        result.Value!.TotalCount.Should().Be(3);
        result.Value!.HasMore.Should().BeTrue();
    }

    // The rule the strike count rests on: one decision settles every report on the same
    // content, so three reporters on one review is one strike, not three.
    [Fact]
    public async Task GetAuthorStatistics_CountsDistinctContentRatherThanReports()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 3, ReportStatus.Upheld, contentId: 1),
            StatRow(4, 3, ReportStatus.Upheld, contentId: 1),
            StatRow(5, 3, ReportStatus.Upheld, contentId: 1)));

        // Act
        var result = await Build(factory).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        var author = result.Value!.Items.Should().ContainSingle().Subject;
        author.NickName.Should().Be("SkogsGreven");
        author.Strikes.Should().Be(1);
    }

    // The same id in two tables is two different pieces of content, so the type has to be
    // part of the distinct key.
    [Fact]
    public async Task GetAuthorStatistics_CountsAReviewAndAnObstacleWithTheSameIdSeparately()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 3, ReportStatus.Upheld, contentId: 1),
            StatRow(2, 3, ReportStatus.Upheld, contentId: 1, contentType: ReportedContentType.TrailObstacle)));

        // Act
        var result = await Build(factory).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Should().ContainSingle().Which.Strikes.Should().Be(2);
    }

    [Fact]
    public async Task GetAuthorStatistics_CountsOnlyUpheldDecisions()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 3, ReportStatus.Pending, contentId: 1),
            StatRow(2, 3, ReportStatus.Dismissed, contentId: 2),
            StatRow(2, 3, ReportStatus.ContentExpired, contentId: 3),
            StatRow(2, 3, ReportStatus.Upheld, contentId: 4)));

        // Act
        var result = await Build(factory).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Should().ContainSingle().Which.Strikes.Should().Be(1);
    }

    [Fact]
    public async Task GetAuthorStatistics_PutsTheMostStrikesFirst()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.AddRange(
            StatRow(2, 3, ReportStatus.Upheld, contentId: 1),
            StatRow(2, 4, ReportStatus.Upheld, contentId: 2),
            StatRow(2, 4, ReportStatus.Upheld, contentId: 3),
            StatRow(2, 4, ReportStatus.Upheld, contentId: 4)));

        // Act
        var result = await Build(factory).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Select(a => a.Strikes).Should().ContainInOrder(3, 1);
        result.Value!.Items.First().AuthorUserId.Should().Be(4);
    }

    // Reading the snapshot alone would show the name the author had when the report was
    // written. The live row wins, so a rename shows up in the list a removal is decided from.
    [Fact]
    public async Task GetAuthorStatistics_PrefersTheLiveNicknameOverTheSnapshot()
    {
        // Arrange
        var factory = CreateSeededFactory(db => db.ContentReports.Add(
            StatRow(2, 3, ReportStatus.Upheld, contentId: 1, authorNickNameSnapshot: "OldName")));

        // Act
        var result = await Build(factory).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Should().ContainSingle().Which.NickName.Should().Be("SkogsGreven");
    }

    [Fact]
    public async Task GetAuthorStatistics_FallsBackToTheSnapshotWhenNoUserRowIsLeft()
    {
        // Arrange - an id with no user row behind it.
        var factory = CreateSeededFactory(db => db.ContentReports.Add(
            StatRow(2, 9999, ReportStatus.Upheld, contentId: 1, authorNickNameSnapshot: "GoneAuthor")));

        // Act
        var result = await Build(factory).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Should().ContainSingle().Which.NickName.Should().Be("GoneAuthor");
    }
}
