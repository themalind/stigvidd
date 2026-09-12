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

public class ContentReportsControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    #region Seed identifiers
    // The test auth handler signs in user 2, VandrarVennen, who wrote review 1 and nothing else.
    private const string AuthenticatedUser = "firebase-uid-12346"; // User 2: VandrarVennen

    private const string OwnReviewIdentifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";  // trail 1, user 2
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";    // trail 1

    // Reviews by other people, in the order the daily-cap test spends them.
    private static readonly string[] OtherPeoplesReviews =
    [
        "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "r3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "r4d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
        "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
        "r6f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
        "r7a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
    ];

    // Review 8 is by SkogsGreven and sits on Tiveden alongside the signed-in user's own.
    private const string OtherReviewOnTivedenIdentifier = "r8b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d";
    #endregion

    public ContentReportsControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient AuthenticatedClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        return client;
    }

    private static CreateContentReportRequest ReportOf(string reviewIdentifier) => new()
    {
        ContentType = nameof(ReportedContentType.Review),
        ContentIdentifier = reviewIdentifier,
        Reason = nameof(ReportReason.Offensive),
        ReporterNote = "Not okay",
    };

    [Fact]
    public async Task Report_ReturnsCreatedAndTakesTheReviewOutOfThePublicList()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf(OtherReviewOnTivedenIdentifier), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var report = await response.Content.ReadFromJsonAsync<ContentReportResponse>(TestContext.Current.CancellationToken);
        report!.HideOutcome.Should().Be(nameof(ReportHideOutcome.Hidden));

        var list = await client.GetFromJsonAsync<PagedReviewResponse>(
            $"/api/v1/Reviews/trail/{TivedenIdentifier}", TestContext.Current.CancellationToken);
        list!.Reviews.Should().NotContain(r => r.Identifier == OtherReviewOnTivedenIdentifier);
        list.Total.Should().Be(1);
    }

    [Fact]
    public async Task Report_WhenTheSameUserReportsTwice_ReturnsConflict()
    {
        // Arrange
        var client = AuthenticatedClient();
        var first = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf(OtherReviewOnTivedenIdentifier), TestContext.Current.CancellationToken);
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        // Act
        var second = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf(OtherReviewOnTivedenIdentifier), TestContext.Current.CancellationToken);

        // Assert
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // Has to run through the endpoint. Reading the switch in ToActionResult proves nothing:
    // without the TooManyRequests branch this comes back as a silent 500.
    [Fact]
    public async Task Report_WhenTheDailyCapIsReached_ReturnsTooManyRequestsNotServerError()
    {
        // Arrange — appsettings caps a reporter at five a day
        var client = AuthenticatedClient();

        for (var i = 0; i < 5; i++)
        {
            var allowed = await client.PostAsJsonAsync(
                "/api/v1/ContentReports", ReportOf(OtherPeoplesReviews[i]), TestContext.Current.CancellationToken);
            allowed.StatusCode.Should().Be(HttpStatusCode.Created);
        }

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf(OtherPeoplesReviews[5]), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task Report_WhenReportingOwnReview_ReturnsBadRequest()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf(OwnReviewIdentifier), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // Already hidden content still has to be reportable, or the second reporter gets a 404
    // on something they saw a moment ago.
    [Fact]
    public async Task Report_WhenTheContentIsAlreadyHidden_IsStillAcceptedAndSaysSo()
    {
        // Arrange
        await HideReviewAsync(OtherReviewOnTivedenIdentifier);

        var client = AuthenticatedClient();

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf(OtherReviewOnTivedenIdentifier), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var report = await response.Content.ReadFromJsonAsync<ContentReportResponse>(TestContext.Current.CancellationToken);
        report!.HideOutcome.Should().Be(nameof(ReportHideOutcome.AlreadyHidden));
    }

    [Fact]
    public async Task Report_WhenTheReviewDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/ContentReports", ReportOf("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetReasons_ReturnsTheEnumNames()
    {
        // Arrange
        var client = AuthenticatedClient();

        // Act
        var reasons = await client.GetFromJsonAsync<List<string>>(
            "/api/v1/ContentReports/reasons", TestContext.Current.CancellationToken);

        // Assert
        reasons.Should().BeEquivalentTo(Enum.GetNames<ReportReason>());
    }

    // Hiding an obstacle also freezes its solved-vote clock, and that is a side effect of
    // the filter rather than something anyone wrote. If a later change excepts the general
    // obstacle lookup, voting on hidden content starts working again and this is what says so.
    [Fact]
    public async Task SolvedVote_OnAHiddenObstacle_ReturnsNotFound()
    {
        // Arrange
        const string obstacleIdentifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
        await HideObstacleAsync(obstacleIdentifier);
        var client = AuthenticatedClient();

        // Act
        var response = await client.PostAsync(
            $"/api/v1/TrailObstacles/solve/{obstacleIdentifier}", null, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // The author gets a 404 on their own hidden review, deliberately. Letting them delete it
    // would let them write a replacement and walk straight past the hiding.
    [Fact]
    public async Task Delete_OnTheOwnersHiddenReview_ReturnsNotFound()
    {
        // Arrange
        await HideReviewAsync(OwnReviewIdentifier);
        var client = AuthenticatedClient();

        // Act
        var response = await client.DeleteAsync(
            $"/api/v1/Reviews/{OwnReviewIdentifier}", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private async Task HideReviewAsync(string identifier)
    {
        using var context = await CreateContextAsync();
        var review = await context.Reviews
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(r => r.Identifier == identifier, TestContext.Current.CancellationToken);
        review.ModerationState = ModerationState.HiddenPendingReview;
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task HideObstacleAsync(string identifier)
    {
        using var context = await CreateContextAsync();
        var obstacle = await context.TrailObstacles
            .IgnoreQueryFilters(["Moderation"])
            .SingleAsync(o => o.Identifier == identifier, TestContext.Current.CancellationToken);
        obstacle.ModerationState = ModerationState.HiddenPendingReview;
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private Task<StigViddDbContext> CreateContextAsync()
    {
        var scope = _factory.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        return contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken);
    }
}
