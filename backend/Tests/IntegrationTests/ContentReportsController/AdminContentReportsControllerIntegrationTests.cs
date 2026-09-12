// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.ContentReport;
using WebDataContracts.ResponseModels.ContentReport;
using WebDataContracts.ResponseModels.Review;

namespace IntegrationTests.ContentReportsController;

public class AdminContentReportsControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen
    private const string AdminRole = "stigvidd-admin";

    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";           // trail 1
    private const string OtherReviewOnTiveden = "r8b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d";        // review 8, user 3
    #endregion

    public AdminContentReportsControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient SignedIn()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        return client;
    }

    private HttpClient Admin()
    {
        var client = SignedIn();
        client.DefaultRequestHeaders.Add("X-Test-Roles", AdminRole);
        return client;
    }

    // Reporting through the app endpoint rather than seeding a row directly: that is the
    // only way the queue is ever populated in reality.
    private async Task<string> ReportAsync(string reviewIdentifier)
    {
        var response = await SignedIn().PostAsJsonAsync(
            "/api/v1/ContentReports",
            new CreateContentReportRequest
            {
                ContentType = nameof(ReportedContentType.Review),
                ContentIdentifier = reviewIdentifier,
                Reason = nameof(ReportReason.Offensive),
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<ContentReportResponse>(TestContext.Current.CancellationToken);
        return created!.Identifier;
    }

    // limit=0 means Take(0) further down, so the paging has to be explicit or the list comes
    // back empty whatever is in it.
    private Task<PagedReviewResponse?> PublicReviewsAsync() =>
        _factory.CreateClient().GetFromJsonAsync<PagedReviewResponse>(
            $"/api/v1/Reviews/trail/{TivedenIdentifier}?page=0&limit=20", TestContext.Current.CancellationToken);

    [Fact]
    public async Task Queue_IsClosedToASignedInNonAdmin()
    {
        // Arrange
        var client = SignedIn();

        // Act
        var response = await client.GetAsync("/api/v1/admin/content-reports/reports", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Queue_ShowsTheReportWithTheAuthorAndTheReporter()
    {
        // Arrange
        await ReportAsync(OtherReviewOnTiveden);

        // Act
        var queue = await Admin().GetFromJsonAsync<PagedResult<ContentReportSummaryResponse>>(
            "/api/v1/admin/content-reports/reports", TestContext.Current.CancellationToken);

        // Assert
        queue!.TotalCount.Should().Be(1);
        var row = queue.Items.Single();
        row.Status.Should().Be(nameof(ReportStatus.Pending));
        row.HideOutcome.Should().Be(nameof(ReportHideOutcome.Hidden));
        row.AuthorNickName.Should().Be("SkogsGreven");
        row.ReporterNickName.Should().Be("VandrarVennen");
        row.ContentStillExists.Should().BeTrue();
    }

    [Fact]
    public async Task Queue_RejectsAnUnknownFilterValueRatherThanIgnoringIt()
    {
        // Arrange
        var client = Admin();

        // Act
        var response = await client.GetAsync(
            "/api/v1/admin/content-reports/reports?status=Nonsense", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Dismiss_PutsTheReviewBackInThePublicList()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);
        var hidden = await PublicReviewsAsync();
        hidden!.Reviews.Should().NotContain(r => r.Identifier == OtherReviewOnTiveden);

        // Act
        var response = await Admin().PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Dismiss" },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var restored = await PublicReviewsAsync();
        restored!.Reviews.Should().Contain(r => r.Identifier == OtherReviewOnTiveden);
    }

    [Fact]
    public async Task Uphold_RemovesTheReviewForGoodAndRecordsOneStrike()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);

        // Act
        var response = await Admin().PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Uphold", DecisionNote = "Breaks the rules" },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var detail = await response.Content.ReadFromJsonAsync<ContentReportDetailResponse>(TestContext.Current.CancellationToken);
        detail!.Report.Status.Should().Be(nameof(ReportStatus.Upheld));
        detail.Report.DecisionNote.Should().Be("Breaks the rules");
        detail.AuthorStrikes.Should().Be(1);
        detail.Report.ContentStillExists.Should().BeFalse();

        // Gone from the table, not merely hidden
        using var scope = _factory.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        using var context = contextFactory.CreateDbContext();
        var stillThere = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .AnyAsync(r => r.Identifier == OtherReviewOnTiveden, TestContext.Current.CancellationToken);
        stillThere.Should().BeFalse();
    }

    [Fact]
    public async Task Uphold_ThenDismiss_ReturnsConflict()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);
        var client = Admin();
        await client.PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Uphold" },
            TestContext.Current.CancellationToken);

        // Act
        var response = await client.PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Dismiss" },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Counts_AddUpAcrossTheStatuses()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);
        var client = Admin();

        // Act
        var before = await client.GetFromJsonAsync<ContentReportCountsResponse>(
            "/api/v1/admin/content-reports/counts", TestContext.Current.CancellationToken);

        await client.PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Dismiss" },
            TestContext.Current.CancellationToken);

        var after = await client.GetFromJsonAsync<ContentReportCountsResponse>(
            "/api/v1/admin/content-reports/counts", TestContext.Current.CancellationToken);

        // Assert
        before!.Pending.Should().Be(1);
        after!.Pending.Should().Be(0);
        after.Dismissed.Should().Be(1);
    }

    [Fact]
    public async Task Vocabulary_ListsTheEnumNamesTheFiltersAreBuiltFrom()
    {
        // Arrange
        var client = Admin();

        // Act
        var response = await client.GetAsync("/api/v1/admin/content-reports/vocabulary", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain(nameof(ReportStatus.Pending));
        body.Should().Contain(nameof(ReportHideOutcome.WithheldReporterDismissed));
    }

    #region The statistics tabs
    private const string SecondReporter = "firebase-uid-12345"; // User 1: NaturElskaren

    private HttpClient SignedInAs(string subjectId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subjectId);
        return client;
    }

    private async Task ReportAsAsync(string subjectId, string reviewIdentifier)
    {
        var response = await SignedInAs(subjectId).PostAsJsonAsync(
            "/api/v1/ContentReports",
            new CreateContentReportRequest
            {
                ContentType = nameof(ReportedContentType.Review),
                ContentIdentifier = reviewIdentifier,
                Reason = nameof(ReportReason.Offensive),
            },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Statistics_AreClosedToASignedInNonAdmin()
    {
        // Arrange
        var client = SignedIn();

        // Act
        var reporters = await client.GetAsync("/api/v1/admin/content-reports/reporters", TestContext.Current.CancellationToken);
        var authors = await client.GetAsync("/api/v1/admin/content-reports/authors", TestContext.Current.CancellationToken);

        // Assert
        reporters.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        authors.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // The rule the strike list rests on, driven all the way through HTTP: two people report
    // the same review, one decision settles both, and the author collects one strike.
    [Fact]
    public async Task Authors_CountOneStrikePerContentHoweverManyPeopleReportedIt()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);
        await ReportAsAsync(SecondReporter, OtherReviewOnTiveden);

        var client = Admin();
        await client.PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Uphold" },
            TestContext.Current.CancellationToken);

        // Act
        var authors = await client.GetFromJsonAsync<PagedResult<AuthorStatisticResponse>>(
            "/api/v1/admin/content-reports/authors", TestContext.Current.CancellationToken);

        // Assert
        var author = authors!.Items.Should().ContainSingle().Subject;
        author.NickName.Should().Be("SkogsGreven");
        author.Strikes.Should().Be(1);
    }

    [Fact]
    public async Task Authors_AreEmptyUntilSomethingIsUpheld()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);
        var client = Admin();

        // Act
        var beforeDecision = await client.GetFromJsonAsync<PagedResult<AuthorStatisticResponse>>(
            "/api/v1/admin/content-reports/authors", TestContext.Current.CancellationToken);

        await client.PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Dismiss" },
            TestContext.Current.CancellationToken);

        var afterDismissal = await client.GetFromJsonAsync<PagedResult<AuthorStatisticResponse>>(
            "/api/v1/admin/content-reports/authors", TestContext.Current.CancellationToken);

        // Assert
        beforeDecision!.Items.Should().BeEmpty();
        afterDismissal!.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Reporters_ShowWhoReportedAndHowTheirReportsTurnedOut()
    {
        // Arrange
        var reportIdentifier = await ReportAsync(OtherReviewOnTiveden);
        var client = Admin();
        await client.PostAsJsonAsync(
            $"/api/v1/admin/content-reports/reports/{reportIdentifier}/decide",
            new DecideContentReportRequest { Decision = "Dismiss" },
            TestContext.Current.CancellationToken);

        // Act
        var reporters = await client.GetFromJsonAsync<PagedResult<ReporterStatisticResponse>>(
            "/api/v1/admin/content-reports/reporters", TestContext.Current.CancellationToken);

        // Assert
        var reporter = reporters!.Items.Should().ContainSingle().Subject;
        reporter.NickName.Should().Be("VandrarVennen");
        reporter.Total.Should().Be(1);
        reporter.Dismissed.Should().Be(1);
        reporter.Pending.Should().Be(0);

        // One dismissal is under the configured threshold, so their reports still hide.
        reporter.ReportsAreWithheld.Should().BeFalse();
    }
    #endregion
}
