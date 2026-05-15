using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class HikeShareRecipientRepositoryTests : TestBase
{
    // Seeded HikeShares:
    //   HikeId=1, SharedWithId=2, SharedById=1
    //   HikeId=2, SharedWithId=3, SharedById=1
    //   HikeId=3, SharedWithId=1, SharedById=2
    //   HikeId=4, SharedWithId=4, SharedById=2
    //   HikeId=5, SharedWithId=5, SharedById=3

    private const int User1Id = 1;
    private const int User2Id = 2;
    private const int User6Id = 6;
    private const int Hike1Id = 1;
    private const int Hike6Id = 6;

    private const string User1Identifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string User6Identifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a44";

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenSharesExist_ReturnsHikes()
    {
        // Arrange — Hike3 is shared with User1
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(User1Identifier, hs => hs.HikeId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllHikesSharedWithUserAsync_WhenNoSharesExist_ReturnsEmptyCollection()
    {
        // Arrange — User6 has nothing shared with them
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.GetAllHikesSharedWithUserAsync(User6Identifier, hs => hs.HikeId, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task HasHikeSharedWithUserAsync_WhenShared_ReturnsTrue()
    {
        // Arrange — Hike1 is shared with User2
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.HasHikeSharedWithUserAsync(User2Id, Hike1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task HasHikeSharedWithUserAsync_WhenNotShared_ReturnsFalse()
    {
        // Arrange — Hike1 is not shared with User6
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.HasHikeSharedWithUserAsync(User6Id, Hike1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteHikeShareAsync_WhenExists_ReturnsSuccess()
    {
        // Arrange — Hike1 is shared with User2
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.DeleteHikeShareAsync(Hike1Id, User2Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteHikeShareAsync_WhenExists_RemovesTheShare()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        await repo.DeleteHikeShareAsync(Hike1Id, User2Id, CancellationToken.None);
        var verify = await repo.HasHikeSharedWithUserAsync(User2Id, Hike1Id, CancellationToken.None);

        // Assert
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteHikeShareAsync_WhenNotExists_ReturnsSuccess()
    {
        // Arrange — Hike6 is not shared with User1
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);

        // Act
        var result = await repo.DeleteHikeShareAsync(Hike6Id, User1Id, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange — add a new share: Hike6 shared with User2 by User5
        var repo = new HikeShareRecipientRepository(CreateSeededFactory(), NullLogger<HikeShareRecipientRepository>.Instance);
        var hikeShare = new HikeShare { HikeId = 6, SharedById = 5, SharedWithId = 2 };

        // Act
        var result = await repo.ReshareSharedHikeAsync(hikeShare, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task ReshareSharedHikeAsync_WhenAdded_IsDetectableByHasHikeSharedWithUser()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeShareRecipientRepository(factory, NullLogger<HikeShareRecipientRepository>.Instance);
        var hikeShare = new HikeShare { HikeId = 6, SharedById = 5, SharedWithId = 2 };

        // Act
        await repo.ReshareSharedHikeAsync(hikeShare, CancellationToken.None);
        var verify = await repo.HasHikeSharedWithUserAsync(User2Id, Hike6Id, CancellationToken.None);

        // Assert
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().BeTrue();
    }
}
