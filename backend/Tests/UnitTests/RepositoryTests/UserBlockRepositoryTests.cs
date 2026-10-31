// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class UserBlockRepositoryTests : TestBase
{
    private const int BlockerUserId = 1;
    private const int BlockedUserId = 2;
    private const int ThirdUserId = 3;

    private static UserBlockRepository Build(Microsoft.EntityFrameworkCore.IDbContextFactory<Infrastructure.Data.StigViddDbContext> factory) =>
        new(factory, NullLogger<UserBlockRepository>.Instance);

    [Fact]
    public async Task BlockAsync_RecordsTheBlock()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var check = await repo.HasBlockedAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);
        check.Value.Should().BeTrue();
    }

    [Fact]
    public async Task BlockAsync_BlockingTwiceIsNotAnError()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = Build(factory);
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task BlockAsync_LeavesTheBlockedOrganizersEvents_ButNotOthers()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            var theirs = EventRepositoryTests.NewEvent(1, organizerId: BlockedUserId);
            theirs.Participants.Add(new EventParticipant { UserId = BlockerUserId });
            theirs.ParticipantCount = 2;
            var interested = EventRepositoryTests.NewEvent(2, organizerId: BlockedUserId);
            interested.Participants.Add(new EventParticipant { UserId = BlockerUserId, Status = EventParticipantStatus.Interested });
            var removed = EventRepositoryTests.NewEvent(3, organizerId: BlockedUserId);
            removed.Participants.Add(new EventParticipant { UserId = BlockerUserId, Status = EventParticipantStatus.Removed });
            var someoneElses = EventRepositoryTests.NewEvent(4, organizerId: ThirdUserId);
            someoneElses.Participants.Add(new EventParticipant { UserId = BlockerUserId });
            someoneElses.Participants.Add(new EventParticipant { UserId = BlockedUserId, Role = EventParticipantRole.CoHost });
            someoneElses.ParticipantCount = 3;
            db.Events.AddRange(theirs, interested, removed, someoneElses);
        });

        // Act
        var result = await Build(factory).BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var rows = await context.EventParticipants
            .Where(p => p.UserId == BlockerUserId)
            .ToDictionaryAsync(p => p.EventId, p => p.Status, TestContext.Current.CancellationToken);
        rows.Should().BeEquivalentTo(new Dictionary<int, EventParticipantStatus>
        {
            [3] = EventParticipantStatus.Removed,
            [4] = EventParticipantStatus.Joined,
        });
        var counts = await context.Events.ToDictionaryAsync(e => e.Id, e => e.ParticipantCount, TestContext.Current.CancellationToken);
        counts[1].Should().Be(1);
        counts[4].Should().Be(3);
    }

    [Fact]
    public async Task BlockAsync_DropsPendingInvitationsToTheBlockedOrganizersEvents_ButNotOthers()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            var theirs = EventRepositoryTests.NewEvent(1, organizerId: BlockedUserId, visibility: EventVisibility.Private);
            theirs.Invitations.Add(new EventInvitation { InvitedUserId = BlockerUserId, InvitedByUserId = BlockedUserId });
            var declined = EventRepositoryTests.NewEvent(2, organizerId: BlockedUserId, visibility: EventVisibility.Private);
            declined.Invitations.Add(new EventInvitation { InvitedUserId = BlockerUserId, Status = EventInvitationStatus.Declined });
            var someoneElses = EventRepositoryTests.NewEvent(3, organizerId: ThirdUserId, visibility: EventVisibility.Private);
            someoneElses.Invitations.Add(new EventInvitation { InvitedUserId = BlockerUserId, InvitedByUserId = BlockedUserId });
            db.Events.AddRange(theirs, declined, someoneElses);
        });

        // Act
        var result = await Build(factory).BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        await using var context = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var invitations = await context.EventInvitations
            .Where(i => i.InvitedUserId == BlockerUserId)
            .ToDictionaryAsync(i => i.EventId, i => i.Status, TestContext.Current.CancellationToken);
        invitations.Should().BeEquivalentTo(new Dictionary<int, EventInvitationStatus>
        {
            [2] = EventInvitationStatus.Declined,
            [3] = EventInvitationStatus.Pending,
        });
    }

    // One-way: the blocked person's view is untouched.
    [Fact]
    public async Task HasBlockedAsync_IsFalseFromTheBlockedSide()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.HasBlockedAsync(BlockedUserId, BlockerUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task HasBlockedAsync_LeavesAnUnrelatedPairAlone()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.HasBlockedAsync(BlockerUserId, ThirdUserId, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task GetUsersWhoBlockedAsync_ReturnsOnlyCandidatesWhoBlockedTheUser()
    {
        // Arrange — 2 blocked the sender (1); the sender blocked 3; 4 blocked the sender but is not a candidate
        const int sender = 1, blockedSender = 2, blockedBySender = 3, notCandidate = 4, unrelated = 5;
        var repo = Build(CreateSeededFactory());
        var ctoken = TestContext.Current.CancellationToken;
        await repo.BlockAsync(blockedSender, sender, ctoken);
        await repo.BlockAsync(sender, blockedBySender, ctoken);
        await repo.BlockAsync(notCandidate, sender, ctoken);

        // Act
        var result = await repo.GetUsersWhoBlockedAsync(sender, [blockedSender, blockedBySender, unrelated], ctoken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Equal(blockedSender);
    }

    [Fact]
    public async Task GetUsersWhoBlockedAsync_WhenNoCandidateBlockedTheUser_ReturnsEmpty()
    {
        // Arrange — only the reverse direction exists
        var repo = Build(CreateSeededFactory());
        var ctoken = TestContext.Current.CancellationToken;
        await repo.BlockAsync(BlockerUserId, BlockedUserId, ctoken);

        // Act
        var result = await repo.GetUsersWhoBlockedAsync(BlockerUserId, [BlockedUserId, ThirdUserId], ctoken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task UnblockAsync_RemovesTheBlock()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.UnblockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var check = await repo.HasBlockedAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);
        check.Value.Should().BeFalse();
    }

    // Only the person who blocked can undo it, so unblocking from the other side finds nothing.
    [Fact]
    public async Task UnblockAsync_DoesNotUndoTheBlockFromTheBlockedSide()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.UnblockAsync(BlockedUserId, BlockerUserId, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
        var check = await repo.HasBlockedAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);
        check.Value.Should().BeTrue();
    }

    [Fact]
    public async Task UnblockAsync_WhenThereIsNoBlock_ReturnsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.UnblockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    // Being blocked hides nothing from your own reads.
    [Fact]
    public async Task GetHiddenUserIdsAsync_HoldsOnlyWhoThisUserBlocked()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);
        await repo.BlockAsync(ThirdUserId, BlockerUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.GetHiddenUserIdsAsync(BlockerUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo([BlockedUserId]);
    }

    [Fact]
    public async Task GetHiddenUserIdsAsync_WithNoBlocks_IsEmpty()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.GetHiddenUserIdsAsync(BlockerUserId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    // The list is the blocker's own, and it carries when the block happened, not when the
    // account was created.
    [Fact]
    public async Task GetBlockedByUserAsync_ReturnsOnlyWhoThisUserBlocked()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());
        await repo.BlockAsync(BlockerUserId, BlockedUserId, TestContext.Current.CancellationToken);
        await repo.BlockAsync(ThirdUserId, BlockerUserId, TestContext.Current.CancellationToken);

        // Act
        var result = await repo.GetBlockedByUserAsync(
            BlockerUserId,
            (block, user) => new { user.Id, block.CreatedAt },
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle();
        var only = result.Value.Single();
        only.Id.Should().Be(BlockedUserId);
        only.CreatedAt.Should().BeAfter(DateTime.UtcNow.AddMinutes(-5));
    }
}
