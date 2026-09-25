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
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.TrailObstacle;

namespace IntegrationTests.Authorization;

public class BlockedContentOnPublicReadsTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string SkogsGrevenSubject = "firebase-uid-12347";
    private const int SkogsGrevenId = 3;
    private const int NaturElskarenId = 1;
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const int VandrarVennenId = 2;

    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string VandrarVennensTivedenReview = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string NaturElskarensTivedenObstacle = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string ObstacleNaturElskarenVotedOn = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public BlockedContentOnPublicReadsTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private async Task BlockAsync(int blockerUserId, int blockedUserId)
    {
        using var scope = _factory.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();
        using var context = await contextFactory.CreateDbContextAsync(TestContext.Current.CancellationToken);

        context.UserBlocks.Add(new UserBlock { BlockerUserId = blockerUserId, BlockedUserId = blockedUserId });

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private HttpClient SignedIn(string subjectId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", subjectId);
        return client;
    }

    private static async Task<IReadOnlyCollection<string>> ReviewIdentifiersAsync(HttpClient client)
    {
        var response = await client.GetAsync(
            $"/api/v1/reviews/trail/{TivedenIdentifier}?page=0&limit=10", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var page = await response.Content.ReadFromJsonAsync<PagedReviewResponse>(TestContext.Current.CancellationToken);
        page.Should().NotBeNull();
        page.Reviews.Should().NotBeNull();
        return page.Reviews.Select(r => r.Identifier).ToList();
    }

    private static async Task<IReadOnlyCollection<TrailObstacleResponse>> ObstaclesAsync(HttpClient client, string trailIdentifier)
    {
        var response = await client.GetAsync(
            $"/api/v1/trailobstacles/trail/{trailIdentifier}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var obstacles = await response.Content.ReadFromJsonAsync<List<TrailObstacleResponse>>(TestContext.Current.CancellationToken);
        obstacles.Should().NotBeNull();
        return obstacles;
    }

    [Fact]
    public async Task Reviews_SignedInBlocker_DoesNotSeeTheBlockedAuthor()
    {
        // Arrange
        await BlockAsync(SkogsGrevenId, VandrarVennenId);

        // Act
        var reviews = await ReviewIdentifiersAsync(SignedIn(SkogsGrevenSubject));

        // Assert
        reviews.Should().NotBeEmpty();
        reviews.Should().NotContain(VandrarVennensTivedenReview);
    }

    [Fact]
    public async Task Reviews_SignedOutReader_StillSeesTheBlockedAuthor()
    {
        // Arrange
        await BlockAsync(SkogsGrevenId, VandrarVennenId);

        // Act
        var reviews = await ReviewIdentifiersAsync(_factory.CreateClient());

        // Assert
        reviews.Should().Contain(VandrarVennensTivedenReview);
    }

    [Fact]
    public async Task Obstacles_SignedInBlocker_DoesNotSeeTheBlockedReporter()
    {
        // Arrange
        await BlockAsync(SkogsGrevenId, NaturElskarenId);

        // Act
        var obstacles = await ObstaclesAsync(SignedIn(SkogsGrevenSubject), TivedenIdentifier);

        // Assert
        obstacles.Select(o => o.Identifier).Should().NotContain(NaturElskarensTivedenObstacle);
    }

    [Fact]
    public async Task Obstacles_SignedOutReader_StillSeesTheBlockedReporter()
    {
        // Arrange
        await BlockAsync(SkogsGrevenId, NaturElskarenId);

        // Act
        var obstacles = await ObstaclesAsync(_factory.CreateClient(), TivedenIdentifier);

        // Assert
        obstacles.Select(o => o.Identifier).Should().Contain(NaturElskarensTivedenObstacle);
    }

    [Fact]
    public async Task Obstacles_SignedInBlocker_DoesNotSeeTheBlockedVoterButCountsTheirVote()
    {
        // Arrange
        var everyone = await ObstaclesAsync(_factory.CreateClient(), StorsjoledenIdentifier);
        var unfiltered = everyone.Should().ContainSingle(o => o.Identifier == ObstacleNaturElskarenVotedOn).Subject;
        unfiltered.SolvedVotes.Should().NotBeNull();
        unfiltered.SolvedVotes.Should().Contain(v => v.UserIdentifier == NaturElskarenIdentifier);
        await BlockAsync(SkogsGrevenId, NaturElskarenId);

        // Act
        var obstacles = await ObstaclesAsync(SignedIn(SkogsGrevenSubject), StorsjoledenIdentifier);

        // Assert
        var obstacle = obstacles.Should().ContainSingle(o => o.Identifier == ObstacleNaturElskarenVotedOn).Subject;
        obstacle.SolvedVotes.Should().NotBeNull();
        obstacle.SolvedVotes.Should().NotContain(v => v.UserIdentifier == NaturElskarenIdentifier);
        obstacle.SolvedVoteCount.Should().Be(unfiltered.SolvedVotes.Count);
    }
}
