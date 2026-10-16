// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.HikeSubmission;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.HikeSubmission;

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

    private async Task<string> SeedPendingSubmissionAsync(params HikeSubmissionImage[] images)
    {
        var identifier = Guid.NewGuid().ToString();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StigViddDbContext>();
        var submission = Pending(identifier, null);
        submission.Images = images;
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
            TransferAcceptedAt = DateTime.UtcNow,
            ConsentTextId = 1,
        };
}
