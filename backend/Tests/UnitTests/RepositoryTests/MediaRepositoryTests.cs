using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class MediaRepositoryTests : TestBase
{
    // Seeded trail image (Tiveden, trail 1) and a facility image added on top of the standard seed,
    // so the repository's three-way media projection (trail / facility / symbol) can be verified.
    private const string SeededTrailImageIdentifier = "img-tiveden-1";
    private const string SeededFacilityImageIdentifier = "fac-media-img";

    private static void SeedFacilityImage(StigViddDbContext db)
    {
        db.FacilityImages.Add(new FacilityImage
        {
            Identifier = SeededFacilityImageIdentifier,
            ImageUrl = "facilities/pic.jpg",
            FacilityId = 1, // Grillplats Tiveden
            Width = 100,
            Height = 100,
            SizeBytes = 999,
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated
        });
    }

    [Fact]
    public async Task GetAllMediaAsync_ReturnsTrailFacilityAndSymbolMedia()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetAllMediaAsync(CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain(m => m.Identifier == SeededTrailImageIdentifier && m.OwnerType == "Trail");
        result.Value.Should().Contain(m => m.Identifier == SeededFacilityImageIdentifier && m.OwnerType == "Facility");
        result.Value.Should().Contain(m => m.OwnerType == "TrailSymbol");
    }

    [Fact]
    public async Task GetAllMediaAsync_ProjectsOwnerNameFromRelatedEntity()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.GetAllMediaAsync(CancellationToken.None);

        // Assert — the trail/facility owner name is projected through the navigation.
        result.Value.Should().Contain(m => m.Identifier == SeededTrailImageIdentifier && m.OwnerName == "Tiveden");
        result.Value.Should().Contain(m => m.Identifier == SeededFacilityImageIdentifier && m.OwnerName == "Grillplats Tiveden");
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenTrailImage_UpdatesAltAndCaption()
    {
        // Arrange
        var factory = CreateSeededFactory(SeedFacilityImage);
        var repo = new MediaRepository(factory, NullLogger<MediaRepository>.Instance);

        // Act
        var update = await repo.UpdateImageMetadataAsync(SeededTrailImageIdentifier, "updated alt", "updated caption", CancellationToken.None);

        // Assert
        update.IsSuccess.Should().BeTrue();

        var all = await repo.GetAllMediaAsync(CancellationToken.None);
        all.Value.Should().Contain(m =>
            m.Identifier == SeededTrailImageIdentifier && m.AltText == "updated alt" && m.Caption == "updated caption");
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenFacilityImage_UpdatesAltAndCaption()
    {
        // Arrange
        var factory = CreateSeededFactory(SeedFacilityImage);
        var repo = new MediaRepository(factory, NullLogger<MediaRepository>.Instance);

        // Act
        var update = await repo.UpdateImageMetadataAsync(SeededFacilityImageIdentifier, "fac alt", "fac caption", CancellationToken.None);

        // Assert
        update.IsSuccess.Should().BeTrue();

        var all = await repo.GetAllMediaAsync(CancellationToken.None);
        all.Value.Should().Contain(m =>
            m.Identifier == SeededFacilityImageIdentifier && m.AltText == "fac alt" && m.Caption == "fac caption");
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenImageMissing_ReturnsNotFound()
    {
        // Arrange
        var repo = new MediaRepository(CreateSeededFactory(SeedFacilityImage), NullLogger<MediaRepository>.Instance);

        // Act
        var result = await repo.UpdateImageMetadataAsync("no-such-image", null, null, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
