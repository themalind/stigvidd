// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebDataContracts.RequestModels.ContentReport;

namespace UnitTests.ServiceTests;

public class ContentReportServiceTests
{
    private const string ReporterIdentifier = "reporter-1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";
    private const string ReviewIdentifier = "review-2b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e";
    private const int ReporterUserId = 11;
    private const int AuthorUserId = 22;
    private const int ReviewId = 5;

    private static ReportableContent VisibleReview(string? snapshot = "Content", int? authorUserId = AuthorUserId) =>
        new(ReviewId, ReviewIdentifier, authorUserId, "Author", 1, "trail-identifier", snapshot, ModerationState.Visible);

    private static CreateContentReportRequest ValidRequest() => new()
    {
        ContentType = nameof(ReportedContentType.Review),
        ContentIdentifier = ReviewIdentifier,
        Reason = nameof(ReportReason.Offensive),
        ReporterNote = "Not okay",
    };

    private static Mock<IConfiguration> Config(int cap = 5, int dismissedThreshold = 3, int snapshotMaxLength = 2000)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["ContentReports:MaxReportsPerUserPerDay"]).Returns(cap.ToString());
        cfg.Setup(c => c["ContentReports:DismissedReportsBeforeHideIsWithheld"]).Returns(dismissedThreshold.ToString());
        cfg.Setup(c => c["ContentReports:SnapshotMaxLength"]).Returns(snapshotMaxLength.ToString());
        return cfg;
    }

    // A repository where every read succeeds and the content is a visible review by someone
    // else, so each test only has to override the one thing it is about.
    private static Mock<IContentReportRepository> HappyRepository(ReportableContent? content = null)
    {
        var repo = new Mock<IContentReportRepository>();

        repo.Setup(r => r.GetReportableContentAsync(It.IsAny<ReportedContentType>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReportableContent>.Success(content ?? VisibleReview()));
        repo.Setup(r => r.CountReportsByReporterSinceAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(0));
        repo.Setup(r => r.CountDismissedReportsByReporterAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(0));
        repo.Setup(r => r.HasReporterAlreadyReportedAsync(It.IsAny<int>(), It.IsAny<ReportedContentType>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));
        repo.Setup(r => r.AddReportAsync(It.IsAny<ContentReport>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ContentReport report, bool _, CancellationToken _) => RepositoryResult<ContentReport>.Success(report));

        return repo;
    }

    private static ContentReportService Build(
        Mock<IContentReportRepository> repo,
        Mock<IConfiguration>? cfg = null,
        Mock<IWebDavService>? webDav = null)
    {
        var userService = new Mock<IUserService>();
        userService.Setup(s => s.GetUserIdByIdentifierAsync(ReporterIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(ReporterUserId));

        return new ContentReportService(
            repo.Object,
            userService.Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            new ContentReportResponseFactory(),
            NullLogger<ContentReportService>.Instance,
            (cfg ?? Config()).Object);
    }

    [Fact]
    public async Task Create_WhenAlreadyReportedByThisUser_ReturnsConflictAndWritesNothing()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.HasReporterAlreadyReportedAsync(It.IsAny<int>(), It.IsAny<ReportedContentType>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        // Act
        var result = await Build(repo).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
        repo.Verify(r => r.AddReportAsync(It.IsAny<ContentReport>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // The pre-check leaves a window, so the unique index is what actually holds. A double tap
    // on a phone button must not come back as a 500.
    [Fact]
    public async Task Create_WhenTheInsertHitsTheUniqueIndex_ReturnsConflictNotServerError()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.AddReportAsync(It.IsAny<ContentReport>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ContentReport>.Conflict());

        // Act
        var result = await Build(repo).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task Create_WhenTheDailyCapIsReached_ReturnsTooManyRequests()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.CountReportsByReporterSinceAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(5));

        // Act
        var result = await Build(repo, Config(cap: 5)).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(429);
        repo.Verify(r => r.AddReportAsync(It.IsAny<ContentReport>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenUnderTheDailyCap_Succeeds()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.CountReportsByReporterSinceAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(4));

        // Act
        var result = await Build(repo, Config(cap: 5)).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    // Zero means no cap, and must short-circuit before the count query rather than run it and
    // compare against zero, which would reject everyone.
    [Fact]
    public async Task Create_WhenTheCapIsZero_SucceedsAndNeverCountsRecentReports()
    {
        // Arrange
        var repo = HappyRepository();

        // Act
        var service = Build(repo, Config(cap: 0));
        for (var i = 0; i < 20; i++)
        {
            var result = await service.CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);
            result.Success.Should().BeTrue();
        }

        // Assert
        repo.Verify(r => r.CountReportsByReporterSinceAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Rolling 24 hours, not a calendar day: the cut-off the service asks for has to move
    // with the clock.
    [Fact]
    public async Task Create_AsksForARollingTwentyFourHourWindow()
    {
        // Arrange
        var repo = HappyRepository();
        DateTime? asked = null;
        repo.Setup(r => r.CountReportsByReporterSinceAsync(It.IsAny<int>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Callback((int _, DateTime since, CancellationToken _) => asked = since)
            .ReturnsAsync(RepositoryResult<int>.Success(0));

        // Act
        await Build(repo).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        asked.Should().NotBeNull();
        asked!.Value.Should().BeCloseTo(DateTime.UtcNow.AddHours(-24), TimeSpan.FromMinutes(1));
    }

    [Fact]
    public async Task Create_WhenTheReporterIsAtTheDismissedThreshold_QueuesTheReportWithoutHiding()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.CountDismissedReportsByReporterAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(3));

        // Act
        var result = await Build(repo, Config(dismissedThreshold: 3)).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.HideOutcome.Should().Be(nameof(ReportHideOutcome.WithheldReporterDismissed));
        repo.Verify(r => r.AddReportAsync(It.IsAny<ContentReport>(), false, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenTheReporterIsBelowTheDismissedThreshold_HidesTheContent()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.CountDismissedReportsByReporterAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        // Act
        var result = await Build(repo, Config(dismissedThreshold: 3)).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.HideOutcome.Should().Be(nameof(ReportHideOutcome.Hidden));
        repo.Verify(r => r.AddReportAsync(It.IsAny<ContentReport>(), true, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenTheDismissedThresholdIsZero_HidesEvenForAHeavilyDismissedReporter()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.CountDismissedReportsByReporterAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(10));

        // Act
        var result = await Build(repo, Config(dismissedThreshold: 0)).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.HideOutcome.Should().Be(nameof(ReportHideOutcome.Hidden));
        repo.Verify(r => r.CountDismissedReportsByReporterAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenTheContentIsAlreadyHidden_RecordsAlreadyHiddenAndDoesNotHideAgain()
    {
        // Arrange
        var hidden = VisibleReview() with { ModerationState = ModerationState.HiddenPendingReview };
        var repo = HappyRepository(hidden);

        // Act
        var result = await Build(repo).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.HideOutcome.Should().Be(nameof(ReportHideOutcome.AlreadyHidden));
        repo.Verify(r => r.AddReportAsync(It.IsAny<ContentReport>(), false, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Create_WhenReportingOwnContent_ReturnsBadRequest()
    {
        // Arrange
        var repo = HappyRepository(VisibleReview(authorUserId: ReporterUserId));

        // Act
        var result = await Build(repo).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
        repo.Verify(r => r.AddReportAsync(It.IsAny<ContentReport>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenTheContentIsLongerThanTheSnapshotLimit_ClipsTheSnapshot()
    {
        // Arrange
        var repo = HappyRepository(VisibleReview(snapshot: new string('x', 500)));
        ContentReport? written = null;
        repo.Setup(r => r.AddReportAsync(It.IsAny<ContentReport>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .Callback((ContentReport report, bool _, CancellationToken _) => written = report)
            .ReturnsAsync((ContentReport report, bool _, CancellationToken _) => RepositoryResult<ContentReport>.Success(report));

        // Act
        var result = await Build(repo, Config(snapshotMaxLength: 100)).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        written!.ContentSnapshot.Should().HaveLength(100);
    }

    [Fact]
    public async Task Create_WhenTheContentTypeIsUnknown_ReturnsBadRequest()
    {
        // Arrange
        var repo = HappyRepository();
        var request = ValidRequest();
        request.ContentType = nameof(ReportedContentType.Unknown);

        // Act
        var result = await Build(repo).CreateAsync(ReporterIdentifier, request, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
        repo.Verify(r => r.GetReportableContentAsync(It.IsAny<ReportedContentType>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Create_WhenTheContentDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = HappyRepository();
        repo.Setup(r => r.GetReportableContentAsync(It.IsAny<ReportedContentType>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReportableContent>.NotFound());

        // Act
        var result = await Build(repo).CreateAsync(ReporterIdentifier, ValidRequest(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    // --- Decisions ---

    private const string ReportIdentifier = "report-3c3d4e5f-6a7b-8c9d-0e1f-2a3b4c5d6e7f";

    private static ContentReport StoredReport(
        ReportStatus status = ReportStatus.Pending,
        ReportedContentType contentType = ReportedContentType.Review) => new()
        {
            Identifier = ReportIdentifier,
            ContentType = contentType,
            ContentId = ReviewId,
            ContentIdentifier = ReviewIdentifier,
            ContentSnapshot = "Content",
            AuthorNickNameSnapshot = "Author",
            ContentAuthorUserId = AuthorUserId,
            ReporterUserId = ReporterUserId,
            Reason = ReportReason.Offensive,
            Status = status,
            HideOutcome = ReportHideOutcome.Hidden,
        };

    private static ContentReportSummary StoredSummary(ReportStatus status = ReportStatus.Pending) =>
        new(ReportIdentifier, ReportedContentType.Review, ReviewIdentifier, "trail-identifier",
            ReportReason.Offensive, null, status, ReportHideOutcome.Hidden,
            "Reporter", "Author", "Content", true, null, null, null, DateTime.UtcNow);

    private static Mock<IContentReportRepository> DecidableRepository(
        ReportStatus current = ReportStatus.Pending,
        ReportedContentType contentType = ReportedContentType.Review,
        IReadOnlyCollection<string>? deletedImageUrls = null,
        int reportsSettled = 1)
    {
        var repo = new Mock<IContentReportRepository>();

        repo.Setup(r => r.GetByIdentifierAsync(ReportIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ContentReport>.Success(StoredReport(current, contentType)));
        repo.Setup(r => r.GetSummaryByIdentifierAsync(ReportIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ContentReportSummary>.Success(StoredSummary(current)));
        repo.Setup(r => r.CountUpheldContentByAuthorAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));
        repo.Setup(r => r.GetReporterRecordAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ReporterRecord>.Success(new ReporterRecord(4, 1, 2, 1)));
        repo.Setup(r => r.ApplyDecisionAsync(
                It.IsAny<ReportedContentType>(), It.IsAny<int>(), It.IsAny<ReportStatus>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ReportedContentType _, int _, ReportStatus decision, string _, string? _, CancellationToken _) =>
                RepositoryResult<DecisionOutcome>.Success(
                    new DecisionOutcome(decision, deletedImageUrls ?? [], reportsSettled)));

        return repo;
    }

    private static DecideContentReportRequest Decide(string decision) => new() { Decision = decision };

    [Fact]
    public async Task Decide_WhenTheDecisionIsNeitherDismissNorUphold_ReturnsBadRequest()
    {
        // Arrange
        var repo = DecidableRepository();

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Maybe"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task Decide_WhenTheReportDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var repo = DecidableRepository();
        repo.Setup(r => r.GetByIdentifierAsync(ReportIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ContentReport>.NotFound());

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Uphold"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    // Idempotent: the same decision again must not rewrite who decided it or when.
    [Fact]
    public async Task Decide_WhenTheSameDecisionIsRepeated_ChangesNothing()
    {
        // Arrange
        var repo = DecidableRepository(current: ReportStatus.Upheld);

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Uphold"), "someone-else", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        repo.Verify(r => r.ApplyDecisionAsync(
            It.IsAny<ReportedContentType>(), It.IsAny<int>(), It.IsAny<ReportStatus>(),
            It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Upholding hard-deletes, so there is nothing left to dismiss afterwards.
    [Fact]
    public async Task Decide_WhenUpheldAndThenDismissed_ReturnsConflict()
    {
        // Arrange
        var repo = DecidableRepository(current: ReportStatus.Upheld);

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Dismiss"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
        repo.Verify(r => r.ApplyDecisionAsync(
            It.IsAny<ReportedContentType>(), It.IsAny<int>(), It.IsAny<ReportStatus>(),
            It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // The content went before anyone decided, but the strike still has to land or a repeat
    // author gets off on timing alone.
    [Fact]
    public async Task Decide_UpholdingContentThatExpired_IsAllowed()
    {
        // Arrange
        var repo = DecidableRepository(current: ReportStatus.ContentExpired);

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Uphold"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        repo.Verify(r => r.ApplyDecisionAsync(
            ReportedContentType.Review, ReviewId, ReportStatus.Upheld, "moderator", null, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Decide_DismissingContentThatExpired_ReturnsConflict()
    {
        // Arrange
        var repo = DecidableRepository(current: ReportStatus.ContentExpired);

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Dismiss"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);
    }

    // A decision is about the content, so every pending report on it is settled together.
    // Otherwise the same review sits in the queue once per reporter.
    [Fact]
    public async Task Decide_SettlesEveryPendingReportOnTheSameContent()
    {
        // Arrange
        var repo = DecidableRepository(reportsSettled: 3);

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Uphold"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        repo.Verify(r => r.ApplyDecisionAsync(
            ReportedContentType.Review, ReviewId, ReportStatus.Upheld, "moderator", null, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // This is the test that catches orphaned files. Nothing else in the repo would notice a
    // deleted review leaving its pictures on the media server forever.
    [Fact]
    public async Task Decide_UpholdingAReviewWithImages_DeletesEveryImageFile()
    {
        // Arrange
        var webDav = Utilities.MockFactory.WebDavService();
        var repo = DecidableRepository(deletedImageUrls: ["https://media/one.jpg", "https://media/two.jpg"]);

        // Act
        var result = await Build(repo, webDav: webDav).DecideAsync(
            ReportIdentifier, Decide("Uphold"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        webDav.Verify(s => s.DeleteFileAsync("https://media/one.jpg"), Times.Once);
        webDav.Verify(s => s.DeleteFileAsync("https://media/two.jpg"), Times.Once);
    }

    // Obstacles have no image column, so nothing should be asked of WebDAV.
    [Fact]
    public async Task Decide_UpholdingAnObstacle_TouchesNoFiles()
    {
        // Arrange
        var webDav = Utilities.MockFactory.WebDavService();
        var repo = DecidableRepository(contentType: ReportedContentType.TrailObstacle);

        // Act
        var result = await Build(repo, webDav: webDav).DecideAsync(
            ReportIdentifier, Decide("Uphold"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        webDav.Verify(s => s.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Decide_ReturnsTheAuthorStrikeCountAndTheReporterRecord()
    {
        // Arrange
        var repo = DecidableRepository();

        // Act
        var result = await Build(repo).DecideAsync(ReportIdentifier, Decide("Dismiss"), "moderator", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.AuthorStrikes.Should().Be(1);
        result.Value.ReporterTotal.Should().Be(4);
        result.Value.ReporterDismissed.Should().Be(2);
    }

    [Fact]
    public async Task GetQueue_WhenAFilterValueIsUnknown_ReturnsBadRequest()
    {
        // Arrange
        var repo = new Mock<IContentReportRepository>();

        // Act
        var result = await Build(repo).GetQueueAsync("Nonsense", null, null, 1, 25, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
        repo.Verify(r => r.GetPagedAsync(
            It.IsAny<ReportStatus?>(), It.IsAny<ReportedContentType?>(), It.IsAny<ReportHideOutcome?>(),
            It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetQueue_ClampsThePageSizeAndTheLowestPageNumber()
    {
        // Arrange
        var repo = new Mock<IContentReportRepository>();
        repo.Setup(r => r.GetPagedAsync(
                It.IsAny<ReportStatus?>(), It.IsAny<ReportedContentType?>(), It.IsAny<ReportHideOutcome?>(),
                It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ContentReportSummary>>.Success(
                new PagedResult<ContentReportSummary>([], 1, false, 0)));

        // Act
        await Build(repo).GetQueueAsync(null, null, null, 0, 5000, CancellationToken.None);

        // Assert
        repo.Verify(r => r.GetPagedAsync(null, null, null, 1, 100, It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- The statistics tabs ---

    private static ReporterStatistic Reporter(int dismissed, int userId = 1) =>
        new(userId, $"Reporter{userId}", dismissed + 2, 1, dismissed, 1, new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc));

    private static Mock<IContentReportRepository> ReportersReturning(params ReporterStatistic[] rows)
    {
        var repo = new Mock<IContentReportRepository>();
        repo.Setup(r => r.GetReporterStatisticsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ReporterStatistic>>.Success(
                new PagedResult<ReporterStatistic>(rows, 1, false, rows.Length)));
        return repo;
    }

    // The marker has to mean exactly one thing: this account's next report will not hide
    // anything. It reads the same threshold the hide decision does.
    [Theory]
    [InlineData(2, false)]
    [InlineData(3, true)]
    [InlineData(9, true)]
    public async Task GetReporterStatistics_MarksReportersWhoseReportsNoLongerHide(int dismissed, bool expected)
    {
        // Arrange
        var repo = ReportersReturning(Reporter(dismissed));
        var service = Build(repo, Config(dismissedThreshold: 3));

        // Act
        var result = await service.GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.Items.Should().ContainSingle().Which.ReportsAreWithheld.Should().Be(expected);
    }

    [Fact]
    public async Task GetReporterStatistics_FollowsTheConfiguredThresholdRatherThanADefault()
    {
        // Arrange - two dismissed is under the built-in three but at a configured two.
        var repo = ReportersReturning(Reporter(2));
        var service = Build(repo, Config(dismissedThreshold: 2));

        // Act
        var result = await service.GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Should().ContainSingle().Which.ReportsAreWithheld.Should().BeTrue();
    }

    [Fact]
    public async Task GetReporterStatistics_CarriesEveryCountThrough()
    {
        // Arrange
        var repo = ReportersReturning(Reporter(dismissed: 4, userId: 7));
        var service = Build(repo);

        // Act
        var result = await service.GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        var row = result.Value!.Items.Should().ContainSingle().Subject;
        row.NickName.Should().Be("Reporter7");
        row.Total.Should().Be(6);
        row.Pending.Should().Be(1);
        row.Dismissed.Should().Be(4);
        row.Upheld.Should().Be(1);
    }

    // Page 0 is what an unset query parameter binds to, and a zero page would ask the
    // repository to skip a negative number of rows.
    [Fact]
    public async Task GetReporterStatistics_TurnsAnUnsetPageIntoTheFirstOne()
    {
        // Arrange
        var repo = ReportersReturning(Reporter(1));
        var service = Build(repo);

        // Act
        await service.GetReporterStatisticsAsync(0, 0, TestContext.Current.CancellationToken);

        // Assert
        repo.Verify(r => r.GetReporterStatisticsAsync(1, It.Is<int>(size => size > 0), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetReporterStatistics_WhenTheReadFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IContentReportRepository>();
        repo.Setup(r => r.GetReporterStatisticsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ReporterStatistic>>.Error());

        // Act
        var result = await Build(repo).GetReporterStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAuthorStatistics_CarriesTheStrikesAndThePagingThrough()
    {
        // Arrange
        var repo = new Mock<IContentReportRepository>();
        repo.Setup(r => r.GetAuthorStatisticsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<AuthorStatistic>>.Success(
                new PagedResult<AuthorStatistic>([new AuthorStatistic(3, "SkogsGreven", 2)], 2, true, 40)));

        // Act
        var result = await Build(repo).GetAuthorStatisticsAsync(2, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Page.Should().Be(2);
        result.Value!.HasMore.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(40);
        var author = result.Value!.Items.Should().ContainSingle().Subject;
        author.NickName.Should().Be("SkogsGreven");
        author.Strikes.Should().Be(2);
    }

    [Fact]
    public async Task GetAuthorStatistics_WhenTheReadFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IContentReportRepository>();
        repo.Setup(r => r.GetAuthorStatisticsAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<AuthorStatistic>>.Error());

        // Act
        var result = await Build(repo).GetAuthorStatisticsAsync(1, 20, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }
}
