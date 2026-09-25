// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Repositories;
using AwesomeAssertions;
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
