using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class HikeRepositoryTests : TestBase
{
    private const string UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const int UserIdNoHikes = 4;
    private const int UserIdWithHikes = 1;
    private const int UserIdNoShares = 5;
    private const string HikeIdentifierSharedNoOwner = "b7a2d4c1-5e9f-4a63-8c1d-0f2e7b9a6c34"; // Hike 2, shared with user 3
    private const string HikeIdentifierOwned = "91e4c2d7-3b8f-4f6a-9d1c-7a2e5b0c8f13";         // Hike 3, still owned by user 2
    private const string HikeIdentifier = "3f9c1b7e-8a42-4e6d-9c5f-2a7b1d8e4f90";
    private const string HikeIdentifierNoShares = "a2f3b1c4-9e7d-4a21-bc5f-3d8e6f1a2b90";


    [Fact]
    public async Task GetHikeByIdentifier_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(HikeIdentifier);
        result.Value.Name.Should().Be("TestHike1");
    }

    [Fact]
    public async Task GetHikeByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeByIdentifierAsync("no-such-hike", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetHikes_WithoutFilter_ReturnsAll()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikesAsync(null, h => h.CreatedBy, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(6);
    }

    [Fact]
    public async Task GetHikes_FilteredByCreator_ReturnsOnlyThatUsersHikes()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikesAsync(UserIdWithHikes, h => h.CreatedBy, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value.Should().AllSatisfy(createdBy => createdBy.Should().Be(UserIdentifier));
    }

    [Fact]
    public async Task GetHikes_WhenUserHasNoHikes_ReturnsEmpty()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        // User 4 (Eremiten) owns no hikes in seed data
        var result = await repo.GetHikesAsync(UserIdNoHikes, h => h.CreatedBy, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateHike_ShouldPersistAndReturn()
    {
        // Arrange
        var factory = CreateSeededFactory();
        var repo = new HikeRepository(factory, NullLogger<HikeRepository>.Instance);
        var hike = new Hike
        {
            Identifier = Guid.NewGuid().ToString(),
            Name = "NewHike",
            HikeLength = 7,
            Duration = 3600000,
            GeoPath = Utilities.GeoPath(),
            CreatedBy = UserIdentifier,
            CreatedByNickName = "TestUser",
        };

        // Act
        var result = await repo.CreateHikeAsync(hike, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("NewHike");

        var verify = await repo.GetHikeByIdentifierAsync(hike.Identifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetHikeIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeIdByIdentifierAsync(HikeIdentifier, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetHikeIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeIdByIdentifierAsync("no-such-hike", CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task DeleteHike_WhenHasShares_SetsUserIdNull()
    {
        // Arrange — seed already contains HikeShare { HikeId=1, SharedWithId=2 } for Hike 1
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);
        var found = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        // Act
        var deleteResult = await repo.DeleteHikeAsync(found.Value!, CancellationToken.None);

        // Assert — the hike stays for the recipients, but the owner is cleared
        deleteResult.IsSuccess.Should().BeTrue();
        var verify = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().NotBeNull();
        verify.Value.UserId.Should().BeNull();
    }

    [Fact]
    public async Task GetDeletableHikeImageUrls_SkipsImagesOnSharedHikes()
    {
        // Arrange — user 1 owns hikes 1 and 2, both of which have HikeShares in the seed,
        // so their images must survive the account deletion.
        var repo = new HikeRepository(CreateSeededFactory(SeedHikeImages), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetDeletableHikeImageUrlsByUserIdAsync(UserIdWithHikes, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetDeletableHikeImageUrls_ReturnsImagesOnUnsharedHikes()
    {
        // Arrange — user 5 owns hike 6, which has no HikeShares, so its images go with it
        var repo = new HikeRepository(CreateSeededFactory(SeedHikeImages), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetDeletableHikeImageUrlsByUserIdAsync(UserIdNoShares, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo(["hikes/hike6-a.jpeg", "hikes/hike6-b.jpeg"]);
    }

    [Fact]
    public async Task HandleUserHikesOnUserDelete_RemovesOnlyHikesWithoutShares()
    {
        // Arrange — user 1 owns hike 1 (shared) and hike 2 (shared); user 5 owns hike 6 (not shared)
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.HandleUserHikesOnUserDeleteAsync(UserIdNoShares, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var deleted = await repo.GetHikeByIdentifierAsync(HikeIdentifierNoShares, CancellationToken.None);
        deleted.IsSuccess.Should().BeFalse();
        var kept = await repo.GetHikeByIdentifierAsync(HikeIdentifier, CancellationToken.None);
        kept.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task HikeHasShares_WhenHikeIsShared_ReturnsTrue()
    {
        // Arrange — hike 1 has a HikeShare in the seed
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.HikeHasSharesAsync(1, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task HikeHasShares_WhenHikeIsNotShared_ReturnsFalse()
    {
        // Arrange — hike 6 has no HikeShares
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.HikeHasSharesAsync(6, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeFalse();
    }

    [Fact]
    public async Task GetHikeImageUrlsByHikeId_ReturnsTheHikesImages()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(SeedHikeImages), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetHikeImageUrlsByHikeIdAsync(6, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo(["hikes/hike6-a.jpeg", "hikes/hike6-b.jpeg"]);
    }

    [Fact]
    public async Task DeleteOrphanedHikes_RemovesOnlyHikesWithNeitherOwnerNorShares()
    {
        // Arrange — hike 2 loses its owner but keeps a share, hike 6 loses its owner and has
        // none, hike 3 keeps its owner. Only hike 6 is stored for nobody.
        var repo = new HikeRepository(CreateSeededFactory(OrphanHikes), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.DeleteOrphanedHikesAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var orphan = await repo.GetHikeByIdentifierAsync(HikeIdentifierNoShares, CancellationToken.None);
        orphan.IsSuccess.Should().BeFalse();
        var stillShared = await repo.GetHikeByIdentifierAsync(HikeIdentifierSharedNoOwner, CancellationToken.None);
        stillShared.IsSuccess.Should().BeTrue();
        var stillOwned = await repo.GetHikeByIdentifierAsync(HikeIdentifierOwned, CancellationToken.None);
        stillOwned.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task GetOrphanedHikeImageUrls_ReturnsOnlyTheOrphansImages()
    {
        // Arrange
        var repo = new HikeRepository(CreateSeededFactory(db => { OrphanHikes(db); SeedHikeImages(db); }), NullLogger<HikeRepository>.Instance);

        // Act
        var result = await repo.GetOrphanedHikeImageUrlsAsync(CancellationToken.None);

        // Assert — hike 2 has an image too, but it still has a share and stays
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo(["hikes/hike6-a.jpeg", "hikes/hike6-b.jpeg"]);
    }

    // Strips the owner from hike 2 (shared) and hike 6 (not shared), leaving only hike 6 orphaned
    private static void OrphanHikes(StigViddDbContext db)
    {
        foreach (var hike in db.Hikes.Where(h => h.Id == 2 || h.Id == 6))
            hike.UserId = null;
    }

    private static void SeedHikeImages(StigViddDbContext db) =>
        db.HikeImages.AddRange(
            new HikeImage { HikeId = 1, ImageUrl = "hikes/hike1-a.jpeg" },
            new HikeImage { HikeId = 2, ImageUrl = "hikes/hike2-a.jpeg" },
            new HikeImage { HikeId = 6, ImageUrl = "hikes/hike6-a.jpeg" },
            new HikeImage { HikeId = 6, ImageUrl = "hikes/hike6-b.jpeg" });

    [Fact]
    public async Task DeleteHike_ShouldRemoveFromDatabase()
    {
        // Arrange — Hike 6 has no HikeShares
        var repo = new HikeRepository(CreateSeededFactory(), NullLogger<HikeRepository>.Instance);
        var found = await repo.GetHikeByIdentifierAsync(HikeIdentifierNoShares, CancellationToken.None);
        found.IsSuccess.Should().BeTrue();

        // Act
        found.Value.Should().NotBeNull();
        var deleteResult = await repo.DeleteHikeAsync(found.Value, CancellationToken.None);

        // Assert — the row is gone, not hidden
        deleteResult.IsSuccess.Should().BeTrue();
        var verify = await repo.GetHikeByIdentifierAsync(HikeIdentifierNoShares, CancellationToken.None);
        verify.IsSuccess.Should().BeFalse();
    }
}
