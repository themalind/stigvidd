// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a blocked person's content does to the reader who blocked them.

using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class BlockVisibilityRepositoryTests : TestBase
{
    private const string TivedenIdentifier = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string TangaledenIdentifier = "33c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";  // user 2
    private const string Review8Identifier = "r8b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d";  // user 3
    private const string Obstacle1Identifier = "ob1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // user 1
    private const string Obstacle3Identifier = "ob3c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"; // 3 solved votes
    private const int ReviewAuthorUserId = 2;
    private const int ObstacleReporterUserId = 1;
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string Obstacle2Identifier = "ob2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const int SolvedVoterUserId = 1;
    private const string UserOneIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const int UserWithAFriend = 1;
    private const int FriendUserId = 2;
    private const int UserWithTwoIncomingRequests = 3;
    private const int RequesterOneUserId = 1;
    private const int RequesterTwoUserId = 2;
    private const int SharerUserId = 2;
    private const int HikeOwnedByUserThree = 5;
    private const int OwnerOfTheResharedHikeUserId = 3;
    private const int UnrelatedSharerUserId = 4;

    private static ReviewRepository BuildReviewRepo(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<ReviewRepository>.Instance);

    private static TrailObstacleRepository BuildObstacleRepo(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<TrailObstacleRepository>.Instance, new ConfigurationBuilder().Build());

    [Fact]
    public async Task Reviews_WithNothingBlocked_AreAllThere()
    {
        // Arrange
        var repo = BuildReviewRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(
            TivedenIdentifier, 0, 20, [], r => r.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().Contain([Review1Identifier, Review8Identifier]);
        result.Value.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Reviews_LeaveOutABlockedAuthorFromBothItemsAndTotalCount()
    {
        // Arrange
        var repo = BuildReviewRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetReviewsByTrailIdentifierAsync(
            TivedenIdentifier, 0, 20, [ReviewAuthorUserId], r => r.Identifier, TestContext.Current.CancellationToken);

        // Assert — both, or the paging offers a page of nothing
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().NotContain(Review1Identifier);
        result.Value.Items.Should().Contain(Review8Identifier);
        result.Value.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task Obstacles_LeaveOutABlockedReporter()
    {
        // Arrange
        var repo = BuildObstacleRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(
            TivedenIdentifier, [ObstacleReporterUserId], o => o.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotContain(Obstacle1Identifier);
    }

    [Fact]
    public async Task Obstacles_WithNothingBlocked_AreAllThere()
    {
        // Arrange
        var repo = BuildObstacleRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(
            TivedenIdentifier, [], o => o.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain(Obstacle1Identifier);
    }

    // Three votes close a report for everyone, a blocked person's vote included.
    [Fact]
    public async Task Obstacles_StillCountASolvedVoteFromSomeoneBlocked()
    {
        // Arrange
        var repo = BuildObstacleRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(
            TangaledenIdentifier, [1, 2, 3], o => o.Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotContain(Obstacle3Identifier);
    }

    [Fact]
    public async Task Obstacles_LoadASolvedVoteFromSomeoneBlocked_SoItIsCounted()
    {
        // Arrange
        var repo = BuildObstacleRepo(CreateSeededFactory());

        // Act
        var result = await repo.GetTrailObstaclesByTrailIdentifierAsync(
            StorsjoledenIdentifier, [SolvedVoterUserId], o => o, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var obstacle = result.Value.Should().ContainSingle().Subject;
        obstacle.Identifier.Should().Be(Obstacle2Identifier);
        obstacle.SolvedVotes.Should().ContainSingle(v => v.UserId == SolvedVoterUserId);
    }

    [Fact]
    public async Task Friends_LeaveOutSomeoneBlocked()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(
            UserWithAFriend, [FriendUserId], u => u.Id, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    // The friendship row is untouched by a block, so only this filter keeps them out of sight.
    [Fact]
    public async Task Friends_KeepSomeoneNotBlocked()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetFriendsAsync(
            UserWithAFriend, [], u => u.Id, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().ContainSingle().Which.Should().Be(FriendUserId);
    }

    [Fact]
    public async Task IncomingRequests_LeaveOutOneFromSomeoneBlocked()
    {
        // Arrange
        var repo = new FriendRepository(CreateSeededFactory(), NullLogger<FriendRepository>.Instance);

        // Act
        var result = await repo.GetIncomingRequestsAsync(
            UserWithTwoIncomingRequests, [RequesterOneUserId], fr => fr.RequesterId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle().Which.Should().Be(RequesterTwoUserId);
    }

    [Fact]
    public async Task SharedWalks_LeaveOutOneSharedBySomeoneBlocked()
    {
        // Arrange
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(
            UserOneIdentifier, [SharerUserId], hs => hs.HikeId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task SharedWalks_KeepOneOwnedBySomeoneBlocked_WhenSomeoneElseSharedIt()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            db.HikeShares.Add(new HikeShare
            {
                HikeId = HikeOwnedByUserThree,
                SharedWithId = UserWithAFriend,
                SharedById = UnrelatedSharerUserId,
                Status = HikeShareStatus.Accepted
            });
        });
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(
            UserOneIdentifier, [OwnerOfTheResharedHikeUserId], hs => hs.HikeId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain(HikeOwnedByUserThree);
    }

    [Fact]
    public async Task SharedWalks_WithNothingBlocked_AreAllThere()
    {
        // Arrange
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(
            UserOneIdentifier, [], hs => hs.HikeId, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().ContainSingle();
    }
}
