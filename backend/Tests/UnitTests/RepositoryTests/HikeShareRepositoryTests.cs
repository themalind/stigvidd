using Core.Repositories;
using FluentAssertions;
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

    // IsAlreadySharedAsync

    [Fact]
    public async Task IsAlreadySharedAsync_WhenAcceptedShareExists_ReturnsTrue()
    {
        // Arrange — Hike1 is Accepted for User2 (id=2)
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);

        // Act
        var result = await repo.IsAlreadySharedAsync(1, 2, CancellationToken.None);

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
        var result = await repo.IsAlreadySharedAsync(2, 1, CancellationToken.None);

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
        var result = await repo.IsAlreadySharedAsync(1, 6, CancellationToken.None);

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
        var result = await repo.GetHikeShareCountAsync(User1Identifier, Hike1Identifier, CancellationToken.None);

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
        var result = await repo.GetHikeShareCountAsync(User6Identifier, Hike1Identifier, CancellationToken.None);

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
        var result = await repo.GetHikeShareCountAsync(User1Identifier, Hike2Identifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task ShareHikeAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new HikeShareRepository(CreateSeededFactory(), NullLogger<HikeShareRepository>.Instance);
        var hikeShare = new HikeShare { HikeId = 6, SharedById = 5, SharedWithId = 1 };

        // Act
        var result = await repo.ShareHikeAsync(hikeShare, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task ShareHikeAsync_WhenAdded_IncreasesShareCount()
    {
        // Arrange — Hike6 (owned by User5) has no shares initially
        var factory = CreateSeededFactory();
        var repo = new HikeShareRepository(factory, NullLogger<HikeShareRepository>.Instance);
        const string user5Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";
        const string hike6Identifier = "a2f3b1c4-9e7d-4a21-bc5f-3d8e6f1a2b90";

        var hikeShare = new HikeShare { HikeId = 6, SharedById = 5, SharedWithId = 1 };

        // Act
        await repo.ShareHikeAsync(hikeShare, CancellationToken.None);
        var count = await repo.GetHikeShareCountAsync(user5Identifier, hike6Identifier, CancellationToken.None);

        // Assert
        count.IsSuccess.Should().BeTrue();
        count.Value.Should().Be(1);
    }
}
