// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Repositories;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class HikeShareRepositoryTests : TestBase
{
    // Seeded: User1 owns Hike1 (id=1, identifier="3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90")
    //         User1 owns Hike2 (id=2, identifier="b7a2d4c1-5e9f-4a63-8c1d-0f2e7b9a6c34")
    //         Hike1 shared with User2, Hike2 shared with User3

    private const string User1Identifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string Hike1Identifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";
    private const string Hike2Identifier = "b7a2d4c1-5e9f-4a63-8c1d-0f2e7b9a6c34";
    private const string User6Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44";
    private const string User2Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
    private const string User3Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d67";
    private const string User5Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";

    // IsAlreadySharedAsync

    [Fact]
    public async Task IsAlreadySharedAsync_WhenAcceptedShareExists_ReturnsTrue()
    {
        // Arrange — Hike1 is Accepted for User2 (id=2)
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.IsAlreadySharedAsync(1, 2, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task IsAlreadySharedAsync_WhenPendingShareExists_ReturnsTrue()
    {
        // Arrange — add a Pending share: Hike2 pending for User1
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = 2, SharedWithId = 1, SharedById = 2, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRepository(factory, NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.IsAlreadySharedAsync(2, 1, TestContext.Current.CancellationToken);

        // Assert — pending shares must also block re-sharing
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task IsAlreadySharedAsync_WhenNoShareExists_ReturnsFalse()
    {
        // Arrange — Hike1 has no share with User6 (id=6)
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.IsAlreadySharedAsync(1, 6, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    // GetHikeShareCountAsync

    [Fact]
    public async Task GetHikeShareCountAsync_WhenHikeHasShares_ReturnsCorrectCount()
    {
        // Arrange
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.GetHikeShareCountAsync(User1Identifier, Hike1Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task GetHikeShareCountAsync_WhenUserDoesNotOwnHike_ReturnsZero()
    {
        // Arrange
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.GetHikeShareCountAsync(User6Identifier, Hike1Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(0);
    }

    [Fact]
    public async Task GetHikeShareCountAsync_WhenMultipleHikesShared_ReturnsCountPerHike()
    {
        // Arrange — User1 owns Hike2 which is shared once (with User3)
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.GetHikeShareCountAsync(User1Identifier, Hike2Identifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task GetHikesSharedByUserAsync_ReturnsEachHikeOnceWithItsRecipients()
    {
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = 1, SharedWithId = 5, SharedById = 1, Status = HikeShareStatus.Pending }));
        var repo = new HikeShareRepository(factory, NullLogger<HikeShareRepository>.Instance);

        var result = await repo.GetHikesSharedByUserAsync(1, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        var hikes = result.Value;
        hikes.Should().NotBeNull();
        if (hikes is null) return;
        hikes.Select(h => h.HikeIdentifier).Should().BeEquivalentTo([Hike1Identifier, Hike2Identifier]);
        hikes.Single(h => h.HikeIdentifier == Hike1Identifier).Recipients.Select(r => r.Identifier)
            .Should().BeEquivalentTo([User2Identifier, User5Identifier]);
        hikes.Should().OnlyContain(h => h.IsOwnHike);
        hikes.Single(h => h.HikeIdentifier == Hike2Identifier).Recipients.Select(r => r.Identifier)
            .Should().BeEquivalentTo([User3Identifier]);
    }

    [Fact]
    public async Task GetHikesSharedByUserAsync_CarriesTheEarliestVisibleImage()
    {
        var jan = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var factory = CreateSeededFactory(ctx => ctx.HikeImages.AddRange(
            new HikeImage { HikeId = 1, ImageUrl = "hidden.jpg", CreatedAt = jan, ModerationState = ModerationState.HiddenPendingReview },
            new HikeImage { HikeId = 1, ImageUrl = "later.jpg", CreatedAt = jan.AddDays(2) },
            new HikeImage { HikeId = 1, ImageUrl = "first.jpg", CreatedAt = jan.AddDays(1) }));
        var repo = new HikeShareRepository(factory, NullLogger<HikeShareRepository>.Instance);

        var result = await repo.GetHikesSharedByUserAsync(1, TestContext.Current.CancellationToken);

        var hikes = result.Value;
        hikes.Should().NotBeNull();
        if (hikes is null) return;
        hikes.Single(h => h.HikeIdentifier == Hike1Identifier).ImageUrl.Should().Be("first.jpg");
        hikes.Single(h => h.HikeIdentifier == Hike2Identifier).ImageUrl.Should().BeNull();
    }

    [Fact]
    public async Task GetHikesSharedByUserAsync_LeavesOutWhatOthersReshared()
    {
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = 1, SharedWithId = 4, SharedById = 2, Status = HikeShareStatus.Accepted }));
        var repo = new HikeShareRepository(factory, NullLogger<HikeShareRepository>.Instance);

        var result = await repo.GetHikesSharedByUserAsync(1, TestContext.Current.CancellationToken);

        var hikes = result.Value;
        hikes.Should().NotBeNull();
        if (hikes is null) return;
        hikes.Single(h => h.HikeIdentifier == Hike1Identifier).Recipients.Select(r => r.Identifier)
            .Should().BeEquivalentTo([User2Identifier]);
    }

    [Fact]
    public async Task GetHikesSharedByUserAsync_MarksAReshareAsSomeoneElsesHike()
    {
        var factory = CreateSeededFactory(ctx =>
            ctx.HikeShares.Add(new HikeShare { HikeId = 1, SharedWithId = 4, SharedById = 2, Status = HikeShareStatus.Accepted }));
        var repo = new HikeShareRepository(factory, NullLogger<HikeShareRepository>.Instance);

        var result = await repo.GetHikesSharedByUserAsync(2, TestContext.Current.CancellationToken);

        var hikes = result.Value;
        hikes.Should().NotBeNull();
        if (hikes is null) return;
        hikes.Single(h => h.HikeIdentifier == Hike1Identifier).IsOwnHike.Should().BeFalse();
    }

    [Fact]
    public async Task GetHikesSharedByUserAsync_WhenNothingShared_ReturnsEmpty()
    {
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        var result = await repo.GetHikesSharedByUserAsync(6, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }
}
