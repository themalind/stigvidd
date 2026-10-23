// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.HikeSubmission;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.HikeSubmission;
using WebDataContracts.ResponseModels.Trail;

namespace IntegrationTests.Admin;

public class AdminHikeSubmissionsControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string AuthenticatedUser = "firebase-uid-12346"; // VandrarVennen

    public AdminHikeSubmissionsControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    [Fact]
    public async Task Approve_AnswersWithTheNewTrailAsJson()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);

        var response = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
        var approved = await response.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var trail = await db.Trails.Include(t => t.Contribution)
            .SingleAsync(t => t.Identifier == approved.TrailIdentifier, TestContext.Current.CancellationToken);
        trail.Contribution.Should().NotBeNull();
        trail.Contribution.ConsentTextId.Should().Be(1);
    }

    [Fact]
    public async Task Approve_CarriesTheVariationOverToTheTrail()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();

        var response = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var approved = await response.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var trail = await db.Trails.SingleAsync(t => t.Identifier == approved.TrailIdentifier, TestContext.Current.CancellationToken);
        trail.AccessibilityInfo.Should().Be("Grusväg och rötter");
        trail.City.Should().Be("Ulricehamn");
    }

    [Fact]
    public async Task Approve_ListsTheTrailAsAContribution()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();
        var response = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);
        var approved = await response.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();

        var trails = await _factory.CreateClient().GetFromJsonAsync<List<TrailShortInfoResponse>>("/api/v1/trails", TestContext.Current.CancellationToken);

        trails.Should().NotBeNull();
        trails.Single(t => t.Identifier == approved.TrailIdentifier).IsContribution.Should().BeTrue();
        trails.Should().Contain(t => !t.IsContribution);
    }

    [Fact]
    public async Task Update_StoresTheVariationAndAnswersWithIt()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();
        var loaded = await client.GetFromJsonAsync<AdminHikeSubmissionResponse>(
            $"/api/v1/admin/hike-submissions/{identifier}", TestContext.Current.CancellationToken);
        loaded.Should().NotBeNull();

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/hike-submissions/{identifier}",
            new { Name = identifier, Description = "Runt sjön", Classification = 2, GettingThere = "Buss 3", AccessibilityInfo = "  Stenigt i backen  ", City = " Borås ", loaded.LastUpdatedAt },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<AdminHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        updated.Should().NotBeNull();
        updated.AccessibilityInfo.Should().Be("Stenigt i backen");
        updated.City.Should().Be("Borås");
    }

    [Fact]
    public async Task Detail_OfAnApprovedSubmission_ShowsThePublishedTrailAsItIsNow()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();
        var response = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);
        var approved = await response.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
            var trail = await db.Trails.SingleAsync(t => t.Identifier == approved.TrailIdentifier, TestContext.Current.CancellationToken);
            trail.Name = "Ändrad i trail-editorn";
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var detail = await client.GetFromJsonAsync<AdminHikeSubmissionResponse>(
            $"/api/v1/admin/hike-submissions/{identifier}", TestContext.Current.CancellationToken);

        detail.Should().NotBeNull();
        detail.Name.Should().Be("Ändrad i trail-editorn");
        detail.GettingThere.Should().Be("Buss 3");
    }

    [Fact]
    public async Task Update_AfterTheTrailWasEditedElsewhere_AnswersConflictAndKeepsTheEdit()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();
        var response = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);
        var approved = await response.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();
        var loaded = await client.GetFromJsonAsync<AdminHikeSubmissionResponse>(
            $"/api/v1/admin/hike-submissions/{identifier}", TestContext.Current.CancellationToken);
        loaded.Should().NotBeNull();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
            var trail = await db.Trails.SingleAsync(t => t.Identifier == approved.TrailIdentifier, TestContext.Current.CancellationToken);
            trail.Name = "Ändrad i trail-editorn";
            trail.LastUpdatedAt = loaded.LastUpdatedAt.AddMinutes(5);
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var update = await client.PutAsJsonAsync(
            $"/api/v1/admin/hike-submissions/{identifier}",
            new { Name = "Från granskningen", loaded.Description, loaded.Classification, loaded.GettingThere, loaded.City, loaded.LastUpdatedAt },
            TestContext.Current.CancellationToken);

        update.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var detail = await client.GetFromJsonAsync<AdminHikeSubmissionResponse>(
            $"/api/v1/admin/hike-submissions/{identifier}", TestContext.Current.CancellationToken);
        detail.Should().NotBeNull();
        detail.Name.Should().Be("Ändrad i trail-editorn");
    }

    [Fact]
    public async Task SimilarRoutes_FlagsAnotherPendingSubmissionOfTheSameWalk()
    {
        var path = Utilities.GeoPath((15.10, 59.10), (15.11, 59.11));
        var identifier = await SeedPendingSubmissionAsync(path);
        var twin = await SeedPendingSubmissionAsync(path);

        var similar = await AdminClient().GetFromJsonAsync<List<SimilarTrailResponse>>(
            $"/api/v1/admin/hike-submissions/{identifier}/similar-routes", TestContext.Current.CancellationToken);

        similar.Should().NotBeNull();
        var match = similar.Should().ContainSingle(s => s.Identifier == twin).Subject;
        match.Kind.Should().Be("Submission");
        match.LikelyDuplicate.Should().BeTrue();
        similar.Should().NotContain(s => s.Identifier == identifier);
    }

    [Fact]
    public async Task SimilarRoutes_LeavesOutTheTrailTheSubmissionPublished()
    {
        var identifier = await SeedPendingSubmissionAsync(Utilities.GeoPath((15.20, 59.20), (15.21, 59.21)));
        var client = AdminClient();
        var response = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);
        var approved = await response.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();

        var similar = await client.GetFromJsonAsync<List<SimilarTrailResponse>>(
            $"/api/v1/admin/hike-submissions/{identifier}/similar-routes", TestContext.Current.CancellationToken);

        similar.Should().NotBeNull();
        similar.Should().NotContain(s => s.Identifier == approved.TrailIdentifier);
    }

    [Fact]
    public async Task Update_WithoutACity_IsRejected()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();

        var response = await client.PutAsJsonAsync(
            $"/api/v1/admin/hike-submissions/{identifier}",
            new { Name = identifier, Description = "Runt sjön", Classification = 2, GettingThere = "Buss 3", City = "  " },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Approve_Twice_AnswersConflictTheSecondTimeAndPublishesOneTrail()
    {
        var identifier = await SeedPendingSubmissionAsync();
        var client = AdminClient();

        var first = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);
        var second = await client.PostAsync($"/api/v1/admin/hike-submissions/{identifier}/approve", null, TestContext.Current.CancellationToken);

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var published = await db.Trails.CountAsync(t => t.Contribution != null && t.Name == identifier, TestContext.Current.CancellationToken);
        published.Should().Be(1);
    }

    [Fact]
    public async Task Detail_LeavesOutACopyWhoseHikePhotoIsHidden()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var hikeId = await db.Hikes.Select(h => h.Id).FirstAsync(TestContext.Current.CancellationToken);
        var visible = new HikeImage { HikeId = hikeId, ImageUrl = "hikes/visible.jpeg", ModerationState = ModerationState.Visible };
        var hidden = new HikeImage { HikeId = hikeId, ImageUrl = "hikes/hidden.jpeg", ModerationState = ModerationState.HiddenPendingReview };
        var identifier = await SeedPendingSubmissionAsync(
            new HikeSubmissionImage { ImageUrl = "trails/visible-copy.jpeg", SortOrder = 0, SourceHikeImage = visible },
            new HikeSubmissionImage { ImageUrl = "trails/hidden-copy.jpeg", SortOrder = 1, SourceHikeImage = hidden });

        var response = await AdminClient().GetAsync($"/api/v1/admin/hike-submissions/{identifier}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var detail = await response.Content.ReadFromJsonAsync<AdminHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        detail.Should().NotBeNull();
        detail.Images.Select(i => i.ImageUrl).Should().ContainSingle().Which.Should().EndWith("trails/visible-copy.jpeg");
    }

    [Fact]
    public async Task Database_RefusesASecondPendingSubmissionForTheSameHike()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var hikeId = await db.Hikes.Select(h => h.Id).FirstAsync(TestContext.Current.CancellationToken);
        db.HikeSubmissions.AddRange(Pending(Guid.NewGuid().ToString(), hikeId), Pending(Guid.NewGuid().ToString(), hikeId));

        var save = () => db.SaveChangesAsync(TestContext.Current.CancellationToken);

        await save.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Create_WithANullImageList_IsABadRequestNotACrash()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        var body = new StringContent(
            $$"""
            {
              "hikeIdentifier": "{{Guid.NewGuid()}}",
              "name": "Kvällsrunda",
              "description": "Runt sjön",
              "classification": 2,
              "gettingThere": "Buss 3",
              "city": "Borås",
              "acceptTransfer": true,
              "consentVersion": "{{HikeSubmissionConsent.CurrentVersion}}",
              "consentLocale": "sv",
              "imageIdentifiers": null
            }
            """,
            System.Text.Encoding.UTF8,
            "application/json");

        var response = await client.PostAsync("/api/v1/HikeSubmissions", body, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).Should().Contain("ImageIdentifiers");
    }

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    private async Task<string> SeedPendingSubmissionAsync(params HikeSubmissionImage[] images) =>
        await SeedPendingSubmissionAsync(null, images);

    private async Task<string> SeedPendingSubmissionAsync(LineString? path, params HikeSubmissionImage[] images)
    {
        var identifier = Guid.NewGuid().ToString();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var submission = Pending(identifier, null);
        submission.Images = images;
        if (path is not null)
            submission.GeoPath = path;
        db.HikeSubmissions.Add(submission);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return identifier;
    }

    private static HikeSubmission Pending(string identifier, int? hikeId) =>
        new()
        {
            Identifier = identifier,
            SourceHikeId = hikeId,
            UserId = 2,
            Name = identifier,
            Description = "Runt sjön",
            GeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
            OriginalGeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
            TrailLength = 1.3m,
            Classification = 2,
            GettingThere = "Buss 3",
            AccessibilityInfo = "Grusväg och rötter",
            City = "Ulricehamn",
            TransferAcceptedAt = DateTime.UtcNow,
            ConsentTextId = 1,
        };
}
