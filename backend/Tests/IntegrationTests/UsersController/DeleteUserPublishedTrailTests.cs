// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.HikeSubmission;

namespace IntegrationTests.UsersController;

public class DeleteUserPublishedTrailTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string VandrarVennenSubject = "firebase-uid-12346";
    private const int NaturElskarenId = 1;
    private const int VandrarVennenId = 2;

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public DeleteUserPublishedTrailTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();

        _factory.KeycloakAdminMock.Reset();
        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private StigViddDbContext Db() =>
        _factory.Services.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

    private HttpClient Client(bool admin = false)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", VandrarVennenSubject);
        if (admin)
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    private static HikeSubmission Submission(string identifier) =>
        new()
        {
            Identifier = identifier,
            UserId = VandrarVennenId,
            Name = identifier,
            Description = "Runt sjön",
            GeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
            OriginalGeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
            TrailLength = 1.3m,
            Classification = 2,
            GettingThere = "Buss 3",
            ShowSubmitterName = true,
            TransferAcceptedAt = DateTime.UtcNow,
            ConsentTextId = 1,
        };

    [Fact]
    public async Task DeleteUser_KeepsThePublishedTrailAndOthersLikesButDropsTheCreditTheirLikesAndSubmissions()
    {
        // Arrange
        var published = Guid.NewGuid().ToString();
        var pending = Guid.NewGuid().ToString();
        using (var db = Db())
        {
            db.HikeSubmissions.AddRange(Submission(published), Submission(pending));
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var approve = await Client(admin: true).PostAsync($"/api/v1/admin/hike-submissions/{published}/approve", null, TestContext.Current.CancellationToken);
        approve.StatusCode.Should().Be(HttpStatusCode.OK);
        var approved = await approve.Content.ReadFromJsonAsync<ApproveHikeSubmissionResponse>(TestContext.Current.CancellationToken);
        approved.Should().NotBeNull();

        int trailId;
        using (var db = Db())
        {
            trailId = await db.Trails.Where(t => t.Identifier == approved.TrailIdentifier).Select(t => t.Id).SingleAsync(TestContext.Current.CancellationToken);
            db.TrailContributionLikes.AddRange(
                new TrailContributionLike { TrailId = trailId, UserId = NaturElskarenId },
                new TrailContributionLike { TrailId = trailId, UserId = VandrarVennenId });
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var response = await Client().SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete"),
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var check = Db();
        var contribution = await check.TrailContributions.SingleOrDefaultAsync(c => c.TrailId == trailId, TestContext.Current.CancellationToken);
        contribution.Should().NotBeNull("the published trail belongs to Stigvidd and outlives the account");
        contribution.SubmittedByUserId.Should().BeNull();
        var likers = await check.TrailContributionLikes.Where(l => l.TrailId == trailId).Select(l => l.UserId).ToListAsync(TestContext.Current.CancellationToken);
        likers.Should().Equal(NaturElskarenId);
        (await check.HikeSubmissions.AnyAsync(s => s.UserId == VandrarVennenId, TestContext.Current.CancellationToken)).Should().BeFalse();
    }
}
