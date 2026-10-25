// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;

namespace IntegrationTests.UsersController;

public class DeleteUserBlocksTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string VandrarVennenSubject = "firebase-uid-12346";
    private const int NaturElskarenId = 1;
    private const int VandrarVennenId = 2;
    private const int SkogsGrevenId = 3;

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public DeleteUserBlocksTests(StigViddWebApplicationFactory<Program> factory)
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

    private async Task SeedBlocksAroundVandrarVennenAsync()
    {
        using var db = Db();
        db.UserBlocks.Add(new UserBlock { BlockerUserId = NaturElskarenId, BlockedUserId = VandrarVennenId });
        db.UserBlocks.Add(new UserBlock { BlockerUserId = VandrarVennenId, BlockedUserId = SkogsGrevenId });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<HttpResponseMessage> DeleteVandrarVennenAsync()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", VandrarVennenSubject);
        return await client.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/v1/users/delete"),
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task DeleteUser_RemovesBlocksInBothDirections()
    {
        // Arrange
        await SeedBlocksAroundVandrarVennenAsync();

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var db = Db();
        var remaining = await db.UserBlocks
            .Where(ub => ub.BlockerUserId == VandrarVennenId || ub.BlockedUserId == VandrarVennenId)
            .CountAsync(TestContext.Current.CancellationToken);
        remaining.Should().Be(0);
    }

    [Fact]
    public async Task DeleteUser_RemovesFriendNotesInBothDirections()
    {
        // Arrange
        using (var seed = Db())
        {
            seed.FriendNotes.Add(new FriendNote { OwnerUserId = VandrarVennenId, FriendUserId = NaturElskarenId, Text = "Kusin" });
            seed.FriendNotes.Add(new FriendNote { OwnerUserId = SkogsGrevenId, FriendUserId = VandrarVennenId, Text = "Grannen" });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var db = Db();
        var remaining = await db.FriendNotes
            .Where(fn => fn.OwnerUserId == VandrarVennenId || fn.FriendUserId == VandrarVennenId)
            .CountAsync(TestContext.Current.CancellationToken);
        remaining.Should().Be(0);
    }

    [Fact]
    public async Task DeleteUser_RemovesTheKeycloakMappingThatCarriesTheirEmail()
    {
        // Arrange
        using (var seed = Db())
        {
            seed.UserKeycloakMappings.Add(new UserKeycloakMapping
            {
                PackageUserId = VandrarVennenId,
                KeycloakSubjectId = "kc-vandrarvennen",
                KeycloakUsername = "vandrarvennen",
                NickName = "VandrarVennen",
                Email = "vandrar@example.com",
            });
            seed.UserKeycloakMappings.Add(new UserKeycloakMapping
            {
                PackageUserId = SkogsGrevenId,
                KeycloakSubjectId = "kc-skogsgreven",
                KeycloakUsername = "skogsgreven",
                NickName = "SkogsGreven",
                Email = "skogs@example.com",
            });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var db = Db();
        var left = await db.UserKeycloakMappings.Select(m => m.PackageUserId).ToListAsync(TestContext.Current.CancellationToken);
        left.Should().Equal(SkogsGrevenId);
    }

    [Fact]
    public async Task DeleteUser_WhenKeycloakDeleteFails_KeepsTheUserAndTheirBlocks()
    {
        // Arrange
        await SeedBlocksAroundVandrarVennenAsync();
        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak unavailable"));

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        using var db = Db();
        (await db.Users.AnyAsync(u => u.Id == VandrarVennenId, TestContext.Current.CancellationToken)).Should().BeTrue();
        var remaining = await db.UserBlocks
            .Where(ub => ub.BlockerUserId == VandrarVennenId || ub.BlockedUserId == VandrarVennenId)
            .CountAsync(TestContext.Current.CancellationToken);
        remaining.Should().Be(2);
    }

    [Fact]
    public async Task DeleteUser_WhenKeycloakDeleteFails_LeavesEverythingTheyOwnUntouched()
    {
        // Arrange
        await SeedBlocksAroundVandrarVennenAsync();
        using (var seed = Db())
        {
            var email = await seed.Users.Where(u => u.Id == VandrarVennenId).Select(u => u.Email)
                .SingleAsync(TestContext.Current.CancellationToken);
            seed.FriendRequests.Add(new FriendRequest { RequesterId = VandrarVennenId, ReceiverId = SkogsGrevenId });
            seed.FriendNotes.Add(new FriendNote { OwnerUserId = VandrarVennenId, FriendUserId = NaturElskarenId, Text = "Kusin" });
            seed.UserKeycloakMappings.Add(new UserKeycloakMapping
            {
                PackageUserId = VandrarVennenId,
                KeycloakSubjectId = "kc-vandrarvennen",
                KeycloakUsername = "vandrarvennen",
                NickName = "VandrarVennen",
                Email = email,
            });
            seed.OutboxEmails.Add(new OutboxEmail
            {
                Identifier = Guid.NewGuid().ToString(),
                ToAddress = email,
                ToName = "VandrarVennen",
                Subject = "Välkommen",
                BodyHtml = "<p>Hej</p>",
                BodyText = "Hej",
                TemplateKey = "welcome",
                Status = OutboxEmailStatus.Sent,
                NextAttemptAt = DateTime.UtcNow,
                SentAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var before = await SnapshotVandrarVennenAsync();
        before.Hikes.Should().NotBeEmpty();
        before.ReceivedShares.Should().NotBeEmpty();
        before.Reviews.Should().Contain(r => r.TrailReview != null);
        before.ReviewImages.Should().NotBeEmpty();
        before.FriendRequests.Should().NotBeEmpty();

        _factory.KeycloakAdminMock
            .Setup(k => k.DeleteUserAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak unavailable"));

        // Act
        var response = await DeleteVandrarVennenAsync();

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        var after = await SnapshotVandrarVennenAsync();
        after.Should().BeEquivalentTo(before);
    }

    private sealed record UserFootprint(
        List<(int Id, string? CreatedBy, string? CreatedByNickName)> Hikes,
        List<int> ReceivedShares,
        List<(int Id, string? TrailReview)> Reviews,
        List<string> ReviewImages,
        List<(int RequesterId, int ReceiverId)> FriendRequests,
        List<string> FriendNotes,
        List<int> Blocks,
        List<string> Mappings,
        List<string> Mail,
        List<string> ObstacleDescriptions);

    private async Task<UserFootprint> SnapshotVandrarVennenAsync()
    {
        var ct = TestContext.Current.CancellationToken;
        using var db = Db();
        var email = await db.Users.Where(u => u.Id == VandrarVennenId).Select(u => u.Email).SingleAsync(ct);

        var hikes = await db.Hikes.IgnoreQueryFilters().Where(h => h.UserId == VandrarVennenId)
            .Select(h => new { h.Id, h.CreatedBy, h.CreatedByNickName }).ToListAsync(ct);
        var reviews = await db.Reviews.IgnoreQueryFilters().Where(r => r.UserId == VandrarVennenId)
            .Select(r => new { r.Id, r.TrailReview }).ToListAsync(ct);
        var requests = await db.FriendRequests
            .Where(fr => fr.RequesterId == VandrarVennenId || fr.ReceiverId == VandrarVennenId)
            .Select(fr => new { fr.RequesterId, fr.ReceiverId }).ToListAsync(ct);

        return new UserFootprint(
            hikes.Select(h => (h.Id, h.CreatedBy, h.CreatedByNickName)).ToList(),
            await db.HikeShares.Where(s => s.SharedWithId == VandrarVennenId).Select(s => s.HikeId).ToListAsync(ct),
            reviews.Select(r => (r.Id, r.TrailReview)).ToList(),
            await db.ReviewImages.IgnoreQueryFilters()
                .Where(ri => ri.Review != null && ri.Review.UserId == VandrarVennenId).Select(ri => ri.ImageUrl).ToListAsync(ct),
            requests.Select(r => (r.RequesterId, r.ReceiverId)).ToList(),
            await db.FriendNotes.Where(fn => fn.OwnerUserId == VandrarVennenId || fn.FriendUserId == VandrarVennenId)
                .Select(fn => fn.Text).ToListAsync(ct),
            await db.UserBlocks.Where(ub => ub.BlockerUserId == VandrarVennenId || ub.BlockedUserId == VandrarVennenId)
                .Select(ub => ub.BlockerUserId == VandrarVennenId ? ub.BlockedUserId : ub.BlockerUserId).ToListAsync(ct),
            await db.UserKeycloakMappings.Where(m => m.PackageUserId == VandrarVennenId).Select(m => m.Email).ToListAsync(ct),
            await db.OutboxEmails.Where(e => e.ToAddress == email).Select(e => e.Identifier).ToListAsync(ct),
            await db.TrailObstacles.IgnoreQueryFilters().Where(o => o.UserId == VandrarVennenId)
                .Select(o => o.Description).ToListAsync(ct));
    }
}
