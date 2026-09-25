// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.RequestModels.Friend;

namespace IntegrationTests.Authorization;

/// <summary>
/// What a ban does, end to end: the account keeps reading and stops writing. The route
/// inventory in BannedUserWriteTests pins which writes stay open; this pins that the
/// refusal happens at all, and that reads are untouched.
/// </summary>
public class BannedUserWriteFilterTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string AuthenticatedUser = "firebase-uid-12346";
    private const string NaturElskarenNickName = "NaturElskaren";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public BannedUserWriteFilterTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private async Task BanAsync(string subjectId)
    {
        using var scope = _factory.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        using var context = await contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken);

        var user = await context.Users.FirstOrDefaultAsync(u => u.SubjectId == subjectId, TestContext.Current.CancellationToken);

        user.Should().NotBeNull();
        context.UserBans.Add(new UserBan { UserId = user.Id, BannedBy = "moderator" });

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private HttpClient Client(string subjectId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subjectId);
        return client;
    }

    [Fact]
    public async Task BannedUser_CannotSendAFriendRequest()
    {
        // Arrange
        await BanAsync(AuthenticatedUser);
        var client = Client(AuthenticatedUser);

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/friends/requests",
            new SendFriendRequestRequest { ReceiverNickName = NaturElskarenNickName },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task BannedUser_CanStillRead()
    {
        // Arrange
        await BanAsync(AuthenticatedUser);
        var client = Client(AuthenticatedUser);

        // Act
        var response = await client.GetAsync("/api/v1/friends", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // The marked writes are the ones a ban must not take away: leaving, deleting, and
    // protecting yourself from someone else.
    [Fact]
    public async Task BannedUser_CanStillBlockSomeone()
    {
        // Arrange
        await BanAsync(AuthenticatedUser);
        var client = Client(AuthenticatedUser);

        // Act
        var response = await client.PostAsync(
            "/api/v1/friends/blocks/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            content: null,
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task UnbannedUser_CanStillWrite()
    {
        // Arrange
        var client = Client(AuthenticatedUser);

        // Act
        var response = await client.PostAsJsonAsync(
            "/api/v1/friends/requests",
            new SendFriendRequestRequest { ReceiverNickName = NaturElskarenNickName },
            TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }
}
